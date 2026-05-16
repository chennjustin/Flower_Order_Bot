import "dotenv/config";
import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";

const port = Number(process.env.PORT ?? 8000);

await runMigrations();
const app = await buildApp(db);
await app.listen({ port, host: "0.0.0.0" });
