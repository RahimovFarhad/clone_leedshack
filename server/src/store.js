import { randomUUID } from "node:crypto";
import { DB_PROVIDER, MONGODB_DB_NAME, MONGODB_URI } from "./config.js";
import { ensureInternalUserId, getSqliteDatabase } from "./sqlite-db.js";

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

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function fromJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
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

function fromSqliteRequestRow(row) {
  return normalizeRequestDoc({
    _id: row.request_id,
    user_id: row.external_user_id,
    text: row.text,
    urgency: row.urgency,
    location: row.location,
    status: row.status,
    category: row.category,
    tags: fromJson(row.tags, []),
    topic_label: row.topic_label,
    mode: row.mode,
    room_id: row.room_id,
    topic_room_id: row.topic_room_id,
    matched_at: row.matched_at,
    updated_at: row.updated_at,
    created_at: row.created_at
  });
}

function fromSqliteRoomRow(row) {
  return normalizeRoomDoc({
    _id: row.room_id,
    type: row.type,
    category: row.category,
    first_tag: row.first_tag,
    status: row.status,
    participants: fromJson(row.participants, []),
    request_ids: fromJson(row.request_ids, []),
    score: row.score,
    reasons: fromJson(row.reasons, []),
    created_at: row.created_at,
    updated_at: row.updated_at
  });
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

  const { MongoClient, ServerApiVersion } = mongodb;
  mongoClient = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
  await mongoClient.connect();
  mongoDb = mongoClient.db(MONGODB_DB_NAME);

  return {
    requests: mongoDb.collection(REQUESTS_COLLECTION),
    rooms: mongoDb.collection(ROOMS_COLLECTION)
  };
}

function getSqliteStore() {
  const db = getSqliteDatabase();
  return { kind: "sqlite", db };
}

async function getStore() {
  const provider = String(DB_PROVIDER || "sqlite").toLowerCase();

  if (provider === "memory") {
    return { kind: "memory" };
  }

  if (provider === "mongo") {
    const collections = await getMongoCollections();
    if (collections) {
      return { kind: "mongo", ...collections };
    }

    if (!warnedFallback) {
      warnedFallback = true;
      console.warn("DB_PROVIDER=mongo but MongoDB is not configured. Falling back to memory store.");
    }
    return { kind: "memory" };
  }

  try {
    return getSqliteStore();
  } catch (error) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(`SQLite init failed (${error.message}). Falling back to memory store.`);
    }
    return { kind: "memory" };
  }
}

export async function createRequest(doc) {
  const store = await getStore();
  const payload = {
    ...doc,
    created_at: doc.created_at || nowIso()
  };

  if (store.kind === "sqlite") {
    const internalUserId = ensureInternalUserId(payload.user_id);
    const result = store.db
      .prepare(
        `INSERT INTO Request (
          user_id, external_user_id, text, tags, intent, urgency, matched, subject,
          status, category, mode, topic_label, location, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        internalUserId,
        String(payload.user_id || "anonymous"),
        payload.text || "",
        toJson(payload.tags || []),
        payload.mode || "",
        payload.urgency || "",
        payload.status === "MATCHED" ? 1 : 0,
        payload.topic_label || "",
        payload.status || "OPEN",
        payload.category || "",
        payload.mode || "",
        payload.topic_label || "",
        payload.location || null,
        payload.created_at
      );

    const row = store.db
      .prepare("SELECT * FROM Request WHERE request_id = ?")
      .get(Number(result.lastInsertRowid));
    return fromSqliteRequestRow(row);
  }

  if (store.kind === "mongo") {
    const result = await store.requests.insertOne(payload);
    return normalizeRequestDoc({ ...payload, _id: result.insertedId });
  }

  const record = normalizeRequestDoc({ ...payload, _id: randomUUID() });
  memory.requests.push(record);
  return record;
}

export async function listOpenRequestsExcludingUser(userId) {
  const store = await getStore();

  if (store.kind === "sqlite") {
    const rows = store.db
      .prepare(
        `SELECT * FROM Request
         WHERE status = 'OPEN' AND external_user_id <> ?
         ORDER BY datetime(created_at) DESC
         LIMIT 500`
      )
      .all(String(userId || ""));

    return rows.map(fromSqliteRequestRow);
  }

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

export async function listUserRequests(userId, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return [];

  const excludeRequestId = String(options.excludeRequestId || "").trim();
  const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 50;
  const store = await getStore();

  if (store.kind === "sqlite") {
    const rows = store.db
      .prepare(
        `SELECT * FROM Request
         WHERE external_user_id = ?
         ORDER BY datetime(created_at) DESC
         LIMIT ?`
      )
      .all(normalizedUserId, limit);

    return rows
      .map(fromSqliteRequestRow)
      .filter((doc) => !excludeRequestId || String(doc._id) !== excludeRequestId);
  }

  if (store.kind === "mongo") {
    const docs = await store.requests
      .find({ user_id: normalizedUserId })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    return docs
      .map(normalizeRequestDoc)
      .filter((doc) => !excludeRequestId || String(doc._id) !== excludeRequestId);
  }

  return memory.requests
    .filter((doc) => doc.user_id === normalizedUserId)
    .sort((a, b) => normalizeDate(b.created_at) - normalizeDate(a.created_at))
    .slice(0, limit)
    .map(normalizeRequestDoc)
    .filter((doc) => !excludeRequestId || String(doc._id) !== excludeRequestId);
}

export async function markRequestsMatched(requestIds, roomId) {
  const ids = requestIds.filter(Boolean).map(String);
  const store = await getStore();

  if (store.kind === "sqlite") {
    const now = nowIso();
    const stmt = store.db.prepare(
      "UPDATE Request SET status = 'MATCHED', matched = 1, room_id = ?, matched_at = ? WHERE request_id = ?"
    );
    for (const id of ids) {
      stmt.run(String(roomId), now, Number(id));
    }
    return;
  }

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
  const store = await getStore();

  if (store.kind === "sqlite") {
    store.db
      .prepare("UPDATE Request SET topic_room_id = ?, updated_at = ? WHERE request_id = ?")
      .run(String(roomId), nowIso(), Number(requestId));
    return;
  }

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

  const store = await getStore();

  if (store.kind === "sqlite") {
    const result = store.db
      .prepare(
        `INSERT INTO Rooms (
          type, participants, request_ids, score, reasons, status, created_at, available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        payload.type,
        toJson(payload.participants),
        toJson(payload.request_ids),
        Number(payload.score || 0),
        toJson(payload.reasons || []),
        payload.status,
        payload.created_at
      );

    const row = store.db
      .prepare("SELECT * FROM Rooms WHERE room_id = ?")
      .get(Number(result.lastInsertRowid));
    return fromSqliteRoomRow(row);
  }

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
  const store = await getStore();

  if (store.kind === "sqlite") {
    const existing = store.db
      .prepare(
        `SELECT * FROM Rooms
         WHERE type = 'TOPIC' AND category = ? AND first_tag = ?
         LIMIT 1`
      )
      .get(category, firstTag);

    if (existing) {
      const participants = new Set(fromJson(existing.participants, []));
      participants.add(userId);
      store.db
        .prepare("UPDATE Rooms SET participants = ?, updated_at = ? WHERE room_id = ?")
        .run(toJson([...participants]), now, Number(existing.room_id));

      const updated = store.db
        .prepare("SELECT * FROM Rooms WHERE room_id = ?")
        .get(Number(existing.room_id));
      return { ...fromSqliteRoomRow(updated), created: false };
    }

    const result = store.db
      .prepare(
        `INSERT INTO Rooms (
          type, category, first_tag, status, participants, created_at, updated_at, available
        ) VALUES ('TOPIC', ?, ?, 'ACTIVE', ?, ?, ?, 1)`
      )
      .run(category, firstTag, toJson([userId]), now, now);

    const created = store.db
      .prepare("SELECT * FROM Rooms WHERE room_id = ?")
      .get(Number(result.lastInsertRowid));
    return { ...fromSqliteRoomRow(created), created: true };
  }

  if (store.kind === "mongo") {
    const existing = await store.rooms.findOne({ type: "TOPIC", category, first_tag: firstTag });
    if (existing) {
      await store.rooms.updateOne(
        { _id: existing._id },
        { $set: { updated_at: now }, $addToSet: { participants: userId } }
      );
      const updated = await store.rooms.findOne({ _id: existing._id });
      return { ...normalizeRoomDoc(updated), created: false };
    }

    const payload = {
      type: "TOPIC",
      category,
      first_tag: firstTag,
      status: "ACTIVE",
      participants: [userId],
      created_at: now,
      updated_at: now
    };
    const result = await store.rooms.insertOne(payload);
    return normalizeRoomDoc({ ...payload, _id: result.insertedId, created: true });
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
    room.created = true;
  } else {
    room.created = false;
  }

  const nextParticipants = new Set([...(room.participants || []), userId]);
  room.participants = [...nextParticipants];
  room.updated_at = now;
  return room;
}
