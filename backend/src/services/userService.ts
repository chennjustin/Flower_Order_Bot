import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";
import { nowTaipeiNaiveSql } from "../utils/time.js";

export async function getLineUidByChatroomId(db: Db, chatRoomId: number): Promise<string | null> {
  const joined = await repo.chatRoomJoinedById(db, chatRoomId);
  return joined?.user?.lineUid ?? null;
}

export async function getUserByLineUid(db: Db, lineUid: string) {
  return repo.userByLineUid(db, lineUid);
}

export async function getUserById(db: Db, userId: number) {
  return repo.userById(db, userId);
}

export async function createUser(db: Db, line_uid: string | null, name: string) {
  const t = nowTaipeiNaiveSql();
  return repo.insertUser(db, {
    lineUid: line_uid,
    name,
    phone: null,
    avatarUrl: null,
    hasOrdered: false,
    createdAt: t,
    updatedAt: t,
  });
}

export async function updateUserInfo(db: Db, userId: number, name?: string | null, phone?: string | null) {
  const user = await repo.userById(db, userId);
  if (!user) throw new Error("User not found");
  const t = nowTaipeiNaiveSql();
  await repo.updateUserRow(db, userId, {
    name: name ?? user.name,
    phone: phone ?? user.phone,
    updatedAt: t,
  });
  return repo.userById(db, userId);
}
