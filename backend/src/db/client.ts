import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
import { resolvePostgresJsUrl } from "../config/settings.js";

const connectionString = resolvePostgresJsUrl();

export const sqlClient = postgres(connectionString, { max: 15 });

export const db = drizzle(sqlClient, { schema });

export async function closeDb(): Promise<void> {
  await sqlClient.end({ timeout: 5 });
}
