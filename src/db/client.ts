// src/db/client.ts
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "devagent.sqlite");

// Ensure the data directory exists before opening the database.
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let instance: Database.Database | null = null;

/**
 * SQLite connection singleton. Reuses one connection for the process lifetime.
 */
export function getDb(): Database.Database {
  if (!instance) {
    instance = new Database(DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
  }
  return instance;
}

export const DB_FILE = DB_PATH;
