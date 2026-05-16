import "dotenv/config";

export type Settings = {
  openaiApiKey: string | undefined;
  lineChannelAccessToken: string | undefined;
  lineChannelSecret: string | undefined;
  databaseUrl: string;
  lineTestResetPhrase: string | undefined;
};

function buildPostgresUrlAsync(): string {
  const user = encodeURIComponent(process.env.POSTGRES_USER ?? "flower");
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? "flower");
  const db = process.env.POSTGRES_DB ?? "flower";
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  return `postgresql+asyncpg://${user}:${password}@${host}:${port}/${db}`;
}

export function resolveDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) {
    let databaseUrl = explicit;
    if (databaseUrl.startsWith("postgres://")) {
      databaseUrl = databaseUrl.replace(/^postgres:\/\//, "postgresql+asyncpg://");
    }
    return databaseUrl;
  }
  if (
    ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT"].some(
      (k) => process.env[k],
    )
  ) {
    return buildPostgresUrlAsync();
  }
  return "sqlite+aiosqlite:///messages.db";
}

/** Normalized `postgresql://...` for postgres.js / Drizzle */
export function resolvePostgresJsUrl(): string {
  const raw = resolveDatabaseUrl();
  if (raw.includes("sqlite")) {
    throw new Error("SQLite backend is not supported in the Node server; use PostgreSQL (DATABASE_URL or POSTGRES_*).");
  }
  let u = raw;
  u = u.replace(/^postgresql\+asyncpg:\/\//, "postgresql://");
  u = u.replace(/^postgresql\+psycopg2:\/\//, "postgresql://");
  if (u.startsWith("postgres://")) u = u.replace(/^postgres:\/\//, "postgresql://");
  return u;
}

export function loadSettings(): Settings {
  const phrase = process.env.LINE_TEST_RESET_PHRASE?.trim();
  return {
    openaiApiKey: process.env.OPENAI_API_KEY,
    lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
    databaseUrl: resolveDatabaseUrl(),
    lineTestResetPhrase: phrase || undefined,
  };
}

let cached: Settings | undefined;

export function getSettings(): Settings {
  if (!cached) cached = loadSettings();
  return cached;
}

export function resetSettingsCache(): void {
  cached = undefined;
}
