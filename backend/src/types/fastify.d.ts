import type { Db } from "../db/repositories.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}
