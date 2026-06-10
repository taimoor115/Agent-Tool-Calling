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

  const users: Array<{ name: string; email: string; created_at: string; plan: "free" | "pro" }> = [
    { name: "Alice Johnson", email: "alice@example.com", created_at: "2024-01-12", plan: "pro" },
    { name: "Bob Smith", email: "bob@example.com", created_at: "2024-02-03", plan: "free" },
    { name: "Carol Martinez", email: "carol@example.com", created_at: "2024-02-20", plan: "pro" },
    { name: "David Lee", email: "david@example.com", created_at: "2024-03-15", plan: "free" },
    { name: "Eve Chen", email: "eve@example.com", created_at: "2024-04-01", plan: "pro" },
    { name: "Frank Wright", email: "frank@example.com", created_at: "2024-05-09", plan: "free" },
    { name: "Grace Kim", email: "grace@example.com", created_at: "2024-06-22", plan: "pro" },
    { name: "Henry Patel", email: "henry@example.com", created_at: "2024-07-30", plan: "free" },
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (name, email, created_at, plan) VALUES (@name, @email, @created_at, @plan)"
  );

  const orders: Array<{
    user_id: number;
    amount: number;
    status: "pending" | "paid" | "refunded" | "cancelled";
    created_at: string;
  }> = [
    { user_id: 1, amount: 49.99, status: "paid", created_at: "2024-02-01" },
    { user_id: 1, amount: 19.0, status: "paid", created_at: "2024-03-11" },
    { user_id: 2, amount: 9.99, status: "pending", created_at: "2024-02-15" },
    { user_id: 3, amount: 99.0, status: "paid", created_at: "2024-03-01" },
    { user_id: 3, amount: 25.5, status: "refunded", created_at: "2024-04-18" },
    { user_id: 4, amount: 5.0, status: "cancelled", created_at: "2024-03-20" },
    { user_id: 5, amount: 149.0, status: "paid", created_at: "2024-04-10" },
    { user_id: 5, amount: 12.0, status: "paid", created_at: "2024-05-02" },
    { user_id: 6, amount: 0.0, status: "pending", created_at: "2024-05-12" },
    { user_id: 7, amount: 199.99, status: "paid", created_at: "2024-06-25" },
    { user_id: 7, amount: 49.99, status: "paid", created_at: "2024-07-04" },
    { user_id: 8, amount: 15.0, status: "pending", created_at: "2024-08-01" },
  ];

  const insertOrder = db.prepare(
    "INSERT INTO orders (user_id, amount, status, created_at) VALUES (@user_id, @amount, @status, @created_at)"
  );

  const insertAll = db.transaction(() => {
    for (const u of users) insertUser.run(u);
    for (const o of orders) insertOrder.run(o);
  });

  insertAll();

  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  const orderCount = db.prepare("SELECT COUNT(*) AS c FROM orders").get() as { c: number };

  // eslint-disable-next-line no-console
  console.log(`✅ Seed complete — ${userCount.c} users, ${orderCount.c} orders.`);
}

seed();
