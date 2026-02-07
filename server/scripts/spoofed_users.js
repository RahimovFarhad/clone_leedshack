import { insertSpoofedUsers } from "../src/sqlite-db.js";

const count = insertSpoofedUsers();
console.log(`${count} users inserted successfully.`);
