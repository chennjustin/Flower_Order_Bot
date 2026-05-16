import { beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";

const dbConfigured = Boolean(process.env.POSTGRES_HOST || process.env.DATABASE_URL);

describe.skipIf(!dbConfigured)("HTTP contract (needs Postgres env)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    try {
      await runMigrations();
    } catch (e) {
      console.warn("Drizzle migrate skipped (often OK if DB already has schema from Alembic):", e);
    }
    app = await buildApp(db);
  });

  it("swagger ui is served at GET /", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.body.toLowerCase()).toContain("swagger");
  });

  it("openapi.json lists frozen core paths", async () => {
    const res = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(res.statusCode).toBe(200);
    const openapi = JSON.parse(res.body) as { paths?: Record<string, unknown> };
    const paths = new Set(Object.keys(openapi.paths ?? {}));

    const expected = new Set([
      "/health",
      "/callback",
      "/orders",
      "/order/{room_id}",
      "/order/{order_id}",
      "/orderdraft/{room_id}",
      "/organize_data/{room_id}",
      "/chat_rooms",
      "/chat_rooms/{room_id}/messages",
      "/chat_rooms/{room_id}/switch_mode",
      "/stats",
      "/payment_methods",
      "/payment_methods/{payment_method_id}",
      "/orders/{order_id}.docx",
      "/generate-fake-data",
    ]);

    const missing = [...expected].filter((p) => !paths.has(p));
    expect(missing, `Missing frozen contract paths: ${missing.join(", ")}`).toEqual([]);
  });

  it("smoke endpoints respond", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect([200, 422]).toContain((await app.inject({ method: "GET", url: "/orders" })).statusCode);
    expect([200, 422]).toContain((await app.inject({ method: "GET", url: "/stats" })).statusCode);
    expect([200, 422]).toContain((await app.inject({ method: "GET", url: "/payment_methods" })).statusCode);
  });
});
