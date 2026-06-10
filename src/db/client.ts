// src/db/client.ts
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// NOTE: We use Node's built-in `node:sqlite` (DatabaseSync) instead of the
// native `better-sqlite3` package. It ships with Node 20.6+/22+, needs no
// compilation and no prebuilt binary download — so the project runs anywhere.
// Requires the `--experimental-sqlite` flag (wired into the npm scripts).
// The API surface used here (prepare/all/get/run/exec) matches better-sqlite3.

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "devagent.sqlite");

// Ensure the data directory exists before opening the database.
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let instance: DatabaseSync | null = null;

/**
 * SQLite connection singleton. Reuses one connection for the process lifetime.
 */
export function getDb(): DatabaseSync {
  if (!instance) {
    instance = new DatabaseSync(DB_PATH);
    instance.exec("PRAGMA journal_mode = WAL;");
    instance.exec("PRAGMA foreign_keys = ON;");
  }
  return instance;
}

export const DB_FILE = DB_PATH;
