import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";
import { DB_PROVIDER, MONGODB_DB_NAME, MONGODB_URI } from "../src/config.js";
import { upsertCommunities } from "../src/sqlite-db.js";

const communities = [
  { community_id: "eng", name: "Engineering", members: 1200, theme: "bg-blue-500" },
  { community_id: "design", name: "Design", members: 600, theme: "bg-emerald-500" },
  { community_id: "first_year", name: "First-Year Study Circle", members: 900, theme: "bg-amber-500" },
  { community_id: "hack_nights", name: "Hack Nights", members: 300, theme: "bg-rose-500" }
];

async function seedMongo() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  try {
    await client.connect();
    const collection = client.db(MONGODB_DB_NAME).collection("communities");

    const operations = communities.map((community) => ({
      updateOne: {
        filter: { community_id: community.community_id },
        update: { $set: community },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });
    const touched = Number(result.upsertedCount || 0) + Number(result.modifiedCount || 0);
    console.log(`${touched} communities upserted in MongoDB.`);
  } finally {
    await client.close();
  }
}

async function main() {
  if (String(DB_PROVIDER || "").toLowerCase() === "mongo") {
    await seedMongo();
    return;
  }

  const seeded = upsertCommunities(communities);
  console.log(`${seeded} communities upserted in SQLite.`);
}

main().catch((error) => {
  console.error("Failed to seed communities:", error.message);
  process.exit(1);
});
