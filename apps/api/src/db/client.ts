// src/db/client.ts
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// NOTE: We use Node's built-in `node:sqlite` (DatabaseSync) instead of the
// native `better-sqlite3` package. It ships with Node 20.6+/22+, needs no
// compilation and no prebuilt binary download — so the project runs anywhere.
// Requires the `--experimental-sqlite` flag (wired into the npm scripts).
// The API surface used here (prepare/all/get/run/exec) matches better-sqlite3.

// On Vercel serverless cwd() is read-only; /tmp is writable per container.
const DATA_DIR = process.env.VERCEL
  ? "/tmp/devagent"
  : path.resolve(process.cwd(), "data");

const DB_PATH = path.join(DATA_DIR, "devagent.sqlite");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let instance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!instance) {
    instance = new DatabaseSync(DB_PATH);
    instance.exec("PRAGMA journal_mode = WAL;");
    instance.exec("PRAGMA foreign_keys = ON;");
    autoSeedIfEmpty(instance);
  }
  return instance;
}

// Create schema and insert mock data if the DB is brand-new (Vercel cold start
// or first local run before `npm run seed`).
function autoSeedIfEmpty(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL,
      plan       TEXT    NOT NULL CHECK (plan IN ('free', 'pro'))
    );
    CREATE TABLE IF NOT EXISTS orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      amount     REAL    NOT NULL,
      status     TEXT    NOT NULL CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
      created_at TEXT    NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const { c } = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (c > 0) return;

  db.exec("BEGIN");
  try {
    const iu = db.prepare("INSERT INTO users (name, email, created_at, plan) VALUES (?, ?, ?, ?)");
    const io = db.prepare("INSERT INTO orders (user_id, amount, status, created_at) VALUES (?, ?, ?, ?)");

    [
      ["Alice Johnson", "alice@example.com", "2024-01-12", "pro"],
      ["Bob Smith", "bob@example.com", "2024-02-03", "free"],
      ["Carol Martinez", "carol@example.com", "2024-02-20", "pro"],
      ["David Lee", "david@example.com", "2024-03-15", "free"],
      ["Eve Chen", "eve@example.com", "2024-04-01", "pro"],
      ["Frank Wright", "frank@example.com", "2024-05-09", "free"],
      ["Grace Kim", "grace@example.com", "2024-06-22", "pro"],
      ["Henry Patel", "henry@example.com", "2024-07-30", "free"],
    ].forEach((u) => iu.run(...(u as [string, string, string, string])));

    [
      [1, 49.99, "paid", "2024-02-01"], [1, 19.0, "paid", "2024-03-11"],
      [2, 9.99, "pending", "2024-02-15"], [3, 99.0, "paid", "2024-03-01"],
      [3, 25.5, "refunded", "2024-04-18"], [4, 5.0, "cancelled", "2024-03-20"],
      [5, 149.0, "paid", "2024-04-10"], [5, 12.0, "paid", "2024-05-02"],
      [6, 0.0, "pending", "2024-05-12"], [7, 199.99, "paid", "2024-06-25"],
      [7, 49.99, "paid", "2024-07-04"], [8, 15.0, "pending", "2024-08-01"],
    ].forEach((o) => io.run(...(o as [number, number, string, string])));

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export const DB_FILE = DB_PATH;
