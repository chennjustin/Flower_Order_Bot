import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";
import { HttpError } from "../lib/httpError.js";
import { linePushMessage } from "../utils/lineSend.js";
import { nowTaipeiNaiveSql } from "../utils/time.js";

export interface ChatMessagePayload {
  text?: string | null;
  image_url?: string | null;
}

export interface ChatMessageOut {
  id: number;
  direction: string;
  user_avatar_url: string | null;
  message: ChatMessagePayload;
  status: string;
  created_at: string;
}

export interface ChatRoomOut {
  room_id: number;
  user_name: string;
  user_avatar_url: string | null;
  unread_count: number;
  status: string;
  last_message: { text: string; timestamp: string } | null;
}

async function latestMessageOut(db: Db, roomId: number): Promise<ChatMessageOut | null> {
  const message = await repo.latestChatMessage(db, roomId);
  if (!message) return null;
  return {
    id: message.id,
    direction: message.direction,
    user_avatar_url: null,
    message: { text: message.text, image_url: message.imageUrl },
    status: message.status,
    created_at: message.createdAt,
  };
}

export async function getChatRoomList(db: Db): Promise<ChatRoomOut[]> {
  const rows = await repo.listChatRoomsJoined(db);
  const response: ChatRoomOut[] = [];
  for (const row of rows) {
    const lastMsg = await latestMessageOut(db, row.room.id);
    response.push({
      room_id: row.room.id,
      user_name: row.user?.name ?? "未知",
      user_avatar_url: row.user?.avatarUrl ?? null,
      unread_count: row.room.unreadCount,
      status: row.room.stage,
      last_message: lastMsg
        ? { text: lastMsg.message.text ?? "", timestamp: lastMsg.created_at }
        : null,
    });
  }
  const min = "1970-01-01 00:00:00";
  response.sort((a, b) => {
    const ta = a.last_message?.timestamp ?? min;
    const tb = b.last_message?.timestamp ?? min;
    return tb.localeCompare(ta);
  });
  return response;
}

export async function getChatRoomByRoomId(db: Db, roomId: number) {
  return repo.chatRoomJoinedById(db, roomId);
}

export async function getChatRoomByUserId(db: Db, userId: number) {
  return repo.chatRoomJoinedByUserId(db, userId);
}

export async function createChatRoom(db: Db, userId: number) {
  const t = nowTaipeiNaiveSql();
  return repo.insertChatRoom(db, {
    userId,
    stage: "WELCOME",
    botStep: -1,
    unreadCount: 0,
    createdAt: t,
    updatedAt: t,
  });
}

export async function getLatestMessage(db: Db, roomId: number) {
  return latestMessageOut(db, roomId);
}

export async function getChatMessages(db: Db, roomId: number, after?: string | null): Promise<ChatMessageOut[]> {
  const chatroom = await repo.chatRoomJoinedById(db, roomId);
  if (!chatroom) throw new HttpError(404, "Chat room not found");
  const messages = await repo.listChatMessages(db, roomId, after);
  const user = chatroom.room.userId ? await repo.userById(db, chatroom.room.userId) : null;
  const avatar = user?.avatarUrl ?? null;
  return messages.map((message) => ({
    id: message.id,
    direction: message.direction,
    user_avatar_url: avatar,
    message: { text: message.text, image_url: message.imageUrl },
    status: message.status,
    created_at: message.createdAt,
  }));
}

export async function switchChatRoomMode(db: Db, roomId: number, mode: string) {
  const t = nowTaipeiNaiveSql();
  await repo.updateChatRoomRow(db, roomId, {
    stage: mode as never,
    updatedAt: t,
  });
}

export async function createChatMessageEntry(
  db: Db,
  roomId: number,
  data: ChatMessagePayload,
  direction: "INCOMING" | "OUTGOING_BY_BOT" | "OUTGOING_BY_STAFF",
) {
  const t = nowTaipeiNaiveSql();
  return repo.insertChatMessage(db, {
    roomId,
    direction,
    text: data.text ?? "",
    imageUrl: data.image_url ?? null,
    status: "SENT",
    processed: false,
    createdAt: t,
    updatedAt: t,
  });
}

export async function createStaffMessage(db: Db, roomId: number, data: ChatMessagePayload): Promise<ChatMessageOut> {
  const room = await repo.chatRoomJoinedById(db, roomId);
  if (!room) throw new Error("Chat room not found");
  const user = room.room.userId ? await repo.userById(db, room.room.userId) : null;
  if (!user?.lineUid) throw new Error("User not found");

  await linePushMessage(user.lineUid, data.text ?? undefined, data.image_url ?? undefined);

  const message = await createChatMessageEntry(db, roomId, data, "OUTGOING_BY_STAFF");

  await repo.updateChatRoomRow(db, room.room.id, { updatedAt: nowTaipeiNaiveSql() });

  return {
    id: message.id,
    direction: message.direction,
    user_avatar_url: null,
    message: { text: message.text, image_url: message.imageUrl },
    status: message.status,
    created_at: message.createdAt,
  };
}
