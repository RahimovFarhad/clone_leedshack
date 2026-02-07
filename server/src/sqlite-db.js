import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLITE_DB_PATH } from "./config.js";

let db;
let initializedPath = "";

function randomEmail() {
  const name = randomUUID().replace(/-/g, "").slice(0, 8);
  const domains = ["example.com", "mail.com", "test.org"];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${name}@${domain}`;
}

function makeExternalUserEmail(externalUserId) {
  const safe = String(externalUserId || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 24) || "anon";

  return `${safe}_${randomUUID().slice(0, 8)}@local.invalid`;
}

function hasColumn(database, table, column) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((row) => String(row.name) === column);
}

function ensureColumn(database, table, column, definition) {
  if (hasColumn(database, table, column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

function initSchema(database) {
  database.exec("PRAGMA foreign_keys = ON;");

  database.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS Communities (
      community_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      members INTEGER DEFAULT 0,
      theme TEXT
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS Rooms (
      room_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tags TEXT,
      available BOOLEAN DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS Room_Request (
      room_id INTEGER,
      user_id INTEGER,
      accepted BOOLEAN DEFAULT 0,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES Rooms(room_id),
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS Request (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tags TEXT,
      intent TEXT,
      urgency TEXT,
      matched BOOLEAN DEFAULT 0,
      subject TEXT,
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS Document (
      document_id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      question TEXT,
      answer TEXT,
      FOREIGN KEY (room_id) REFERENCES Rooms(room_id)
    );
  `);

  // Mapping external caller IDs (headers/body) to Users.user_id for FK-safe inserts.
  database.exec(`
    CREATE TABLE IF NOT EXISTS User_External_Map (
      external_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );
  `);

  // Extra columns required by current backend flow.
  ensureColumn(database, "Request", "external_user_id", "TEXT");
  ensureColumn(database, "Request", "text", "TEXT");
  ensureColumn(database, "Request", "status", "TEXT DEFAULT 'OPEN'");
  ensureColumn(database, "Request", "category", "TEXT");
  ensureColumn(database, "Request", "mode", "TEXT");
  ensureColumn(database, "Request", "topic_label", "TEXT");
  ensureColumn(database, "Request", "location", "TEXT");
  ensureColumn(database, "Request", "room_id", "TEXT");
  ensureColumn(database, "Request", "topic_room_id", "TEXT");
  ensureColumn(database, "Request", "matched_at", "TEXT");
  ensureColumn(database, "Request", "updated_at", "TEXT");
  ensureColumn(database, "Request", "created_at", "TEXT");

  ensureColumn(database, "Rooms", "type", "TEXT");
  ensureColumn(database, "Rooms", "category", "TEXT");
  ensureColumn(database, "Rooms", "first_tag", "TEXT");
  ensureColumn(database, "Rooms", "status", "TEXT");
  ensureColumn(database, "Rooms", "participants", "TEXT");
  ensureColumn(database, "Rooms", "request_ids", "TEXT");
  ensureColumn(database, "Rooms", "score", "REAL");
  ensureColumn(database, "Rooms", "reasons", "TEXT");
  ensureColumn(database, "Rooms", "created_at", "TEXT");
  ensureColumn(database, "Rooms", "updated_at", "TEXT");
}

export function getSqliteDatabase() {
  if (db) return db;

  const dbPath = String(SQLITE_DB_PATH || "data/data.db").trim() || "data/data.db";
  const absolutePath = resolve(dbPath);
  mkdirSync(dirname(absolutePath), { recursive: true });

  db = new DatabaseSync(absolutePath);
  initializedPath = absolutePath;
  initSchema(db);
  return db;
}

export function initializeSqliteDatabase() {
  getSqliteDatabase();
  return initializedPath;
}

export function insertSpoofedUsers() {
  const database = getSqliteDatabase();
  const users = [
    ["alice", randomEmail()],
    ["bob", randomEmail()],
    ["charlie", randomEmail()]
  ];

  const stmt = database.prepare("INSERT INTO Users (username, email) VALUES (?, ?)");
  for (const [username, email] of users) {
    stmt.run(username, email);
  }

  return users.length;
}

export function ensureInternalUserId(externalUserId) {
  const database = getSqliteDatabase();
  const externalId = String(externalUserId || "").trim() || "anonymous";

  const existing = database
    .prepare("SELECT user_id FROM User_External_Map WHERE external_id = ?")
    .get(externalId);
  if (existing?.user_id) {
    return Number(existing.user_id);
  }

  const username = externalId.slice(0, 100) || "anonymous";
  const email = makeExternalUserEmail(externalId);
  const insertUser = database.prepare("INSERT INTO Users (username, email) VALUES (?, ?)");
  const result = insertUser.run(username, email);
  const userId = Number(result.lastInsertRowid);

  database
    .prepare("INSERT INTO User_External_Map (external_id, user_id) VALUES (?, ?)")
    .run(externalId, userId);

  return userId;
}

export function listCommunities() {
  const database = getSqliteDatabase();
  return database
    .prepare("SELECT community_id, name, members, theme FROM Communities ORDER BY name ASC")
    .all();
}

export function getCommunityById(communityId) {
  const database = getSqliteDatabase();
  return (
    database
      .prepare("SELECT community_id, name, members, theme FROM Communities WHERE community_id = ?")
      .get(String(communityId || "").trim()) || null
  );
}

export function upsertCommunities(communities) {
  const database = getSqliteDatabase();
  const rows = Array.isArray(communities) ? communities : [];
  if (rows.length === 0) return 0;

  const stmt = database.prepare(
    `INSERT INTO Communities (community_id, name, members, theme)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(community_id) DO UPDATE SET
       name = excluded.name,
       members = excluded.members,
       theme = excluded.theme`
  );

  for (const row of rows) {
    const id = String(row?.community_id || row?.id || "").trim();
    const name = String(row?.name || "").trim();
    if (!id || !name) continue;

    stmt.run(
      id,
      name,
      Number.isFinite(Number(row?.members)) ? Number(row.members) : 0,
      String(row?.theme || "").trim() || null
    );
  }

  return rows.length;
}
