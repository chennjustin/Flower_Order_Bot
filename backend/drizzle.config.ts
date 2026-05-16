import "dotenv/config";
import { defineConfig } from "drizzle-kit";

function migrateUrl(): string {
  const explicit = process.env.DATABASE_ALEM_URL?.trim();
  if (explicit) return explicit.replace(/^postgresql\+psycopg2:\/\//, "postgresql://");

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl) {
    let u = dbUrl;
    if (u.startsWith("postgres://")) u = u.replace(/^postgres:\/\//, "postgresql://");
    u = u.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
    return u;
  }

  const user = encodeURIComponent(process.env.POSTGRES_USER ?? "flower");
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? "flower");
  const db = process.env.POSTGRES_DB ?? "flower";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrateUrl(),
  },
});
