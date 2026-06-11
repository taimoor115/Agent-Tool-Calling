// src/db/seed.ts
import { getDb } from "./client";

/**
 * Seed script: creates the `users` and `orders` tables and populates them
 * with realistic mock data. Safe to run repeatedly (drops + recreates).
 *
 * Run with:  npm run seed
 */
function seed(): void {
  const db = getDb();

  db.exec(`
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL,
      plan       TEXT    NOT NULL CHECK (plan IN ('free', 'pro'))
    );

    CREATE TABLE orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      amount     REAL    NOT NULL,
      status     TEXT    NOT NULL CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
      created_at TEXT    NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const users: Array<[name: string, email: string, created_at: string, plan: string]> = [
    ["Alice Johnson", "alice@example.com", "2024-01-12", "pro"],
    ["Bob Smith", "bob@example.com", "2024-02-03", "free"],
    ["Carol Martinez", "carol@example.com", "2024-02-20", "pro"],
    ["David Lee", "david@example.com", "2024-03-15", "free"],
    ["Eve Chen", "eve@example.com", "2024-04-01", "pro"],
    ["Frank Wright", "frank@example.com", "2024-05-09", "free"],
    ["Grace Kim", "grace@example.com", "2024-06-22", "pro"],
    ["Henry Patel", "henry@example.com", "2024-07-30", "free"],
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (name, email, created_at, plan) VALUES (?, ?, ?, ?)"
  );

  const orders: Array<[user_id: number, amount: number, status: string, created_at: string]> = [
    [1, 49.99, "paid", "2024-02-01"],
    [1, 19.0, "paid", "2024-03-11"],
    [2, 9.99, "pending", "2024-02-15"],
    [3, 99.0, "paid", "2024-03-01"],
    [3, 25.5, "refunded", "2024-04-18"],
    [4, 5.0, "cancelled", "2024-03-20"],
    [5, 149.0, "paid", "2024-04-10"],
    [5, 12.0, "paid", "2024-05-02"],
    [6, 0.0, "pending", "2024-05-12"],
    [7, 199.99, "paid", "2024-06-25"],
    [7, 49.99, "paid", "2024-07-04"],
    [8, 15.0, "pending", "2024-08-01"],
  ];

  const insertOrder = db.prepare(
    "INSERT INTO orders (user_id, amount, status, created_at) VALUES (?, ?, ?, ?)"
  );

  // Simple explicit transaction for an atomic seed.
  db.exec("BEGIN");
  try {
    for (const u of users) insertUser.run(...u);
    for (const o of orders) insertOrder.run(...o);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  const orderCount = db.prepare("SELECT COUNT(*) AS c FROM orders").get() as { c: number };

  // eslint-disable-next-line no-console
  console.log(`✅ Seed complete — ${userCount.c} users, ${orderCount.c} orders.`);
}

seed();
