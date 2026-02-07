import { initializeSqliteDatabase } from "../src/sqlite-db.js";

const path = initializeSqliteDatabase();
console.log(`Database initialized at: ${path}`);
