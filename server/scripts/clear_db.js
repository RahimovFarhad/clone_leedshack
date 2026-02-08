import "dotenv/config";
import { clearCommunitiesStore } from "../src/community-store.js";
import { clearStoreData } from "../src/store.js";

async function main() {
  const storeResult = await clearStoreData();
  const communitiesResult = await clearCommunitiesStore();

  console.log("Database clear complete.");
  console.log(JSON.stringify({ store: storeResult, communities: communitiesResult }, null, 2));
}

main().catch((error) => {
  console.error("Failed to clear database:", error);
  process.exit(1);
});
