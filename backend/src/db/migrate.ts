import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { resolvePostgresJsUrl } from "../config/settings.js";

function isBenignMigrationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate key") ||
    msg.includes("relation") && msg.includes("already exists")
  );
}

/** True when core tables exist (e.g. DB was created by legacy Alembic). */
async function schemaAlreadyPresent(client: postgres.Sql): Promise<boolean> {
  const rows = await client<{ reg: string | null }[]>`
    SELECT to_regclass('public.chat_room')::text AS reg
  `;
  return Boolean(rows[0]?.reg);
}

export async function runMigrations(): Promise<void> {
  const url = resolvePostgresJsUrl();
  const migrationClient = postgres(url, { max: 1 });

  try {
    if (await schemaAlreadyPresent(migrationClient)) {
      const journal = await migrationClient<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
        ) AS exists
      `;
      if (!journal[0]?.exists) {
        console.warn(
          "[migrate] Existing PostgreSQL schema detected (likely Alembic). Skipping Drizzle migrate on startup.",
        );
        console.warn(
          "[migrate] For a fresh DB only, run: npm run migrate",
        );
        return;
      }
    }

    const migrationDb = drizzle(migrationClient);
    await migrate(migrationDb, { migrationsFolder: `${process.cwd()}/drizzle` });
  } catch (err) {
    if (isBenignMigrationError(err)) {
      console.warn("[migrate] Drizzle migrate skipped:", err instanceof Error ? err.message : err);
      return;
    }
    throw err;
  } finally {
    await migrationClient.end({ timeout: 5 });
  }
}
