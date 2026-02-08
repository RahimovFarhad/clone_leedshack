import { DB_PROVIDER, MONGODB_DB_NAME, MONGODB_URI } from "./config.js";
import { getCommunityById as getSqliteCommunityById, listCommunities as listSqliteCommunities } from "./sqlite-db.js";

const COMMUNITIES_COLLECTION = "communities";

let mongoClient;
let mongoDb;
let warnedFallback = false;

function isPlaceholderMongoUri(uri) {
  const normalized = String(uri || "").trim();
  return !normalized || normalized.includes("your_mongo_uri_here");
}

async function getMongoCollection() {
  if (isPlaceholderMongoUri(MONGODB_URI)) return null;
  if (mongoDb) {
    return mongoDb.collection(COMMUNITIES_COLLECTION);
  }

  let mongodb;
  try {
    mongodb = await import("mongodb");
  } catch {
    throw new Error("MongoDB driver not installed. Run: npm install mongodb");
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
  return mongoDb.collection(COMMUNITIES_COLLECTION);
}

function normalizeCommunityDoc(doc) {
  if (!doc) return null;
  const id = String(doc.community_id || doc.id || doc._id || "").trim();
  const name = String(doc.name || "").trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    members: Number(doc.members || 0),
    theme: String(doc.theme || "")
  };
}

export async function listCommunitiesStore() {
  const provider = String(DB_PROVIDER || "sqlite").toLowerCase();

  if (provider === "mongo") {
    try {
      const collection = await getMongoCollection();
      if (!collection) {
        if (!warnedFallback) {
          warnedFallback = true;
          console.warn("DB_PROVIDER=mongo but MONGODB_URI is not configured. Falling back to SQLite communities.");
        }
      } else {
      const docs = await collection.find({}).sort({ name: 1 }).limit(500).toArray();
      return docs.map(normalizeCommunityDoc).filter(Boolean);
      }
    } catch (error) {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn(`Mongo communities lookup failed (${error.message}). Falling back to SQLite.`);
      }
    }
  }

  return listSqliteCommunities().map((row) =>
    normalizeCommunityDoc({
      community_id: row.community_id,
      name: row.name,
      members: row.members,
      theme: row.theme
    })
  ).filter(Boolean);
}

export async function getCommunityByIdStore(communityId) {
  const id = String(communityId || "").trim();
  if (!id) return null;

  const provider = String(DB_PROVIDER || "sqlite").toLowerCase();

  if (provider === "mongo") {
    try {
      const collection = await getMongoCollection();
      if (!collection) {
        if (!warnedFallback) {
          warnedFallback = true;
          console.warn("DB_PROVIDER=mongo but MONGODB_URI is not configured. Falling back to SQLite communities.");
        }
      } else {
        const doc = await collection.findOne({ community_id: id });
        return normalizeCommunityDoc(doc);
      }
    } catch (error) {
      if (!warnedFallback) {
        warnedFallback = true;
        console.warn(`Mongo community lookup failed (${error.message}). Falling back to SQLite.`);
      }
    }
  }

  const row = getSqliteCommunityById(id);
  if (!row) return null;
  return normalizeCommunityDoc({
    community_id: row.community_id,
    name: row.name,
    members: row.members,
    theme: row.theme
  });
}
