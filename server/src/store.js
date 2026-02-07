import { randomUUID } from "node:crypto";
import { MONGODB_DB_NAME, MONGODB_URI } from "./config.js";

const REQUESTS_COLLECTION = "requests";
const ROOMS_COLLECTION = "rooms";

const memory = {
  requests: [],
  rooms: []
};

let mongoClient;
let mongoDb;
let warnedFallback = false;

function isPlaceholderMongoUri(uri) {
  const normalized = String(uri || "").trim();
  return !normalized || normalized.includes("your_mongo_uri_here");
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.toHexString === "function") return value.toHexString();
  return String(value);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeDate(value) {
  if (!value) return new Date(0);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return new Date(0);
  return parsed;
}

function normalizeRequestDoc(doc) {
  return {
    ...doc,
    _id: normalizeId(doc._id),
    created_at: normalizeDate(doc.created_at)
  };
}

function normalizeRoomDoc(doc) {
  return {
    ...doc,
    _id: normalizeId(doc._id),
    created_at: normalizeDate(doc.created_at)
  };
}

async function getMongoCollections() {
  if (isPlaceholderMongoUri(MONGODB_URI)) return null;
  if (mongoDb) {
    return {
      requests: mongoDb.collection(REQUESTS_COLLECTION),
      rooms: mongoDb.collection(ROOMS_COLLECTION)
    };
  }

  let mongodb;
  try {
    mongodb = await import("mongodb");
  } catch {
    throw new Error(
      "MongoDB URI is configured, but 'mongodb' package is not installed. Run: npm install mongodb"
    );
  }

  const { MongoClient } = mongodb;
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  mongoDb = mongoClient.db(MONGODB_DB_NAME);

  return {
    requests: mongoDb.collection(REQUESTS_COLLECTION),
    rooms: mongoDb.collection(ROOMS_COLLECTION)
  };
}

async function getCollectionsOrMemory() {
  const collections = await getMongoCollections();
  if (collections) return { kind: "mongo", ...collections };
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      "MongoDB not configured (MONGODB_URI placeholder). Using in-memory store for /post-request."
    );
  }
  return { kind: "memory" };
}

export async function createRequest(doc) {
  const store = await getCollectionsOrMemory();
  const payload = {
    ...doc,
    created_at: doc.created_at || nowIso()
  };

  if (store.kind === "mongo") {
    const result = await store.requests.insertOne(payload);
    return normalizeRequestDoc({ ...payload, _id: result.insertedId });
  }

  const record = normalizeRequestDoc({ ...payload, _id: randomUUID() });
  memory.requests.push(record);
  return record;
}

export async function listOpenRequestsExcludingUser(userId) {
  const store = await getCollectionsOrMemory();
  if (store.kind === "mongo") {
    const docs = await store.requests
      .find({ status: "OPEN", user_id: { $ne: userId } })
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();
    return docs.map(normalizeRequestDoc);
  }

  return memory.requests
    .filter((doc) => doc.status === "OPEN" && doc.user_id !== userId)
    .sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at))
    .map(normalizeRequestDoc);
}

export async function markRequestsMatched(requestIds, roomId) {
  const ids = requestIds.filter(Boolean).map(String);
  const store = await getCollectionsOrMemory();

  if (store.kind === "mongo") {
    const { ObjectId } = await import("mongodb");
    const objectIds = ids
      .map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (objectIds.length) {
      await store.requests.updateMany(
        { _id: { $in: objectIds } },
        { $set: { status: "MATCHED", room_id: roomId, matched_at: nowIso() } }
      );
    }
    return;
  }

  memory.requests = memory.requests.map((doc) => {
    if (!ids.includes(String(doc._id))) return doc;
    return { ...doc, status: "MATCHED", room_id: roomId, matched_at: nowIso() };
  });
}

export async function attachRequestToRoom(requestId, roomId) {
  if (!requestId || !roomId) return;
  const store = await getCollectionsOrMemory();

  if (store.kind === "mongo") {
    const { ObjectId } = await import("mongodb");
    let objectId;
    try {
      objectId = new ObjectId(String(requestId));
    } catch {
      return;
    }
    await store.requests.updateOne(
      { _id: objectId },
      { $set: { topic_room_id: roomId, updated_at: nowIso() } }
    );
    return;
  }

  memory.requests = memory.requests.map((doc) => {
    if (String(doc._id) !== String(requestId)) return doc;
    return { ...doc, topic_room_id: roomId, updated_at: nowIso() };
  });
}

export async function createDirectRoom({ userIds, requestIds, score, reasons }) {
  const payload = {
    type: "DIRECT",
    participants: [...new Set(userIds.filter(Boolean))],
    request_ids: requestIds.filter(Boolean).map(String),
    score,
    reasons,
    status: "ACTIVE",
    created_at: nowIso()
  };

  const store = await getCollectionsOrMemory();
  if (store.kind === "mongo") {
    const result = await store.rooms.insertOne(payload);
    return normalizeRoomDoc({ ...payload, _id: result.insertedId });
  }

  const record = normalizeRoomDoc({ ...payload, _id: randomUUID() });
  memory.rooms.push(record);
  return record;
}

export async function findOrCreateTopicRoom({ category, firstTag, userId }) {
  const now = nowIso();
  const store = await getCollectionsOrMemory();

  if (store.kind === "mongo") {
    const result = await store.rooms.findOneAndUpdate(
      { type: "TOPIC", category, first_tag: firstTag },
      {
        $setOnInsert: {
          type: "TOPIC",
          category,
          first_tag: firstTag,
          status: "ACTIVE",
          created_at: now
        },
        $set: { updated_at: now },
        $addToSet: { participants: userId }
      },
      { upsert: true, returnDocument: "after" }
    );
    return normalizeRoomDoc(result.value);
  }

  let room = memory.rooms.find(
    (doc) => doc.type === "TOPIC" && doc.category === category && doc.first_tag === firstTag
  );

  if (!room) {
    room = normalizeRoomDoc({
      _id: randomUUID(),
      type: "TOPIC",
      category,
      first_tag: firstTag,
      status: "ACTIVE",
      participants: [],
      created_at: now
    });
    memory.rooms.push(room);
  }

  const nextParticipants = new Set([...(room.participants || []), userId]);
  room.participants = [...nextParticipants];
  room.updated_at = now;
  return room;
}
