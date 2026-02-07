import { upsertCommunities } from "../src/sqlite-db.js";

const seeded = upsertCommunities([
  { community_id: "eng", name: "Engineering", members: 1200, theme: "bg-blue-500" },
  { community_id: "design", name: "Design", members: 600, theme: "bg-emerald-500" },
  { community_id: "first_year", name: "First-Year Study Circle", members: 900, theme: "bg-amber-500" },
  { community_id: "hack_nights", name: "Hack Nights", members: 300, theme: "bg-rose-500" }
]);

console.log(`${seeded} communities upserted.`);
