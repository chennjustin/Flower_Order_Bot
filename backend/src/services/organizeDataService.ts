import type { Db } from "../db/repositories.js";
import { organizeOrderDraft } from "../usecases/organizeOrderDraft.js";

export async function organizeData(db: Db, chatRoomId: number) {
  return organizeOrderDraft(db, chatRoomId);
}
