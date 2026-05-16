import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";

export async function wipeLineCustomerForDev(db: Db, roomId: number, userId: number) {
  await repo.wipeLineCustomerGraph(db, roomId, userId);
}
