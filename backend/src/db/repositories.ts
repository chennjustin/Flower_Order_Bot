import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema.js";
import {
  chatMessage,
  chatRoom,
  notification,
  orderDraft,
  orders as orderTable,
  payment,
  paymentMethod,
  storeDisplayConfig,
  users,
} from "./schema.js";
import { startOfMonthTaipeiSql, startOfTodayTaipeiSql } from "../utils/timeParts.js";

export type Db = PostgresJsDatabase<typeof schema>;

export async function orderById(db: Db, orderId: number) {
  const rows = await db.select().from(orderTable).where(eq(orderTable.id, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function listActiveOrders(db: Db) {
  return db.select().from(orderTable).where(ne(orderTable.status, "CANCELLED"));
}

export async function latestConfirmedOrderByRoom(db: Db, roomId: number) {
  const rows = await db
    .select()
    .from(orderTable)
    .where(and(eq(orderTable.roomId, roomId), eq(orderTable.status, "CONFIRMED")))
    .orderBy(desc(orderTable.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function latestOrderDraftByRoom(db: Db, roomId: number) {
  const rows = await db
    .select()
    .from(orderDraft)
    .where(eq(orderDraft.roomId, roomId))
    .orderBy(desc(orderDraft.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertOrder(db: Db, row: typeof orderTable.$inferInsert) {
  const ins = await db.insert(orderTable).values(row).returning();
  return ins[0]!;
}

export async function updateOrderFields(
  db: Db,
  orderId: number,
  patch: Partial<Omit<typeof orderTable.$inferInsert, "id" | "createdAt">>,
) {
  await db.update(orderTable).set(patch).where(eq(orderTable.id, orderId));
}

export async function insertOrderDraft(db: Db, row: typeof orderDraft.$inferInsert) {
  const ins = await db.insert(orderDraft).values(row).returning();
  return ins[0]!;
}

export async function updateOrderDraftRow(db: Db, id: number, patch: Partial<typeof orderDraft.$inferInsert>) {
  await db.update(orderDraft).set(patch).where(eq(orderDraft.id, id));
}

export async function userById(db: Db, userId: number) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function userByLineUid(db: Db, lineUid: string) {
  const rows = await db.select().from(users).where(eq(users.lineUid, lineUid)).limit(1);
  return rows[0] ?? null;
}

export async function userByChatRoomId(db: Db, chatRoomId: number) {
  const rows = await db
    .select({ user: users })
    .from(chatRoom)
    .innerJoin(users, eq(chatRoom.userId, users.id))
    .where(eq(chatRoom.id, chatRoomId))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function insertUser(db: Db, row: typeof users.$inferInsert) {
  const ins = await db.insert(users).values(row).returning();
  return ins[0]!;
}

export async function updateUserRow(db: Db, userId: number, patch: Partial<typeof users.$inferInsert>) {
  await db.update(users).set(patch).where(eq(users.id, userId));
}

export async function latestChatMessage(db: Db, roomId: number) {
  const rows = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.roomId, roomId))
    .orderBy(desc(chatMessage.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listChatRoomsJoined(db: Db) {
  return db
    .select({
      room: chatRoom,
      user: users,
    })
    .from(chatRoom)
    .leftJoin(users, eq(chatRoom.userId, users.id))
    .orderBy(desc(chatRoom.updatedAt));
}

export async function chatRoomJoinedById(db: Db, roomId: number) {
  const rows = await db
    .select({
      room: chatRoom,
      user: users,
    })
    .from(chatRoom)
    .leftJoin(users, eq(chatRoom.userId, users.id))
    .where(eq(chatRoom.id, roomId))
    .limit(1);
  return rows[0] ?? null;
}

export async function chatRoomJoinedByUserId(db: Db, userId: number) {
  const rows = await db
    .select({
      room: chatRoom,
      user: users,
    })
    .from(chatRoom)
    .leftJoin(users, eq(chatRoom.userId, users.id))
    .where(eq(chatRoom.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertChatRoom(db: Db, row: typeof chatRoom.$inferInsert) {
  const ins = await db.insert(chatRoom).values(row).returning();
  return ins[0]!;
}

export async function updateChatRoomRow(db: Db, roomId: number, patch: Partial<typeof chatRoom.$inferInsert>) {
  await db.update(chatRoom).set(patch).where(eq(chatRoom.id, roomId));
}

export async function listChatMessages(db: Db, roomId: number, after?: string | null) {
  return db
    .select()
    .from(chatMessage)
    .where(
      after
        ? and(eq(chatMessage.roomId, roomId), sql`${chatMessage.createdAt} > ${after}`)
        : eq(chatMessage.roomId, roomId),
    )
    .orderBy(asc(chatMessage.createdAt));
}

export async function insertChatMessage(db: Db, row: typeof chatMessage.$inferInsert) {
  const ins = await db.insert(chatMessage).values(row).returning();
  return ins[0]!;
}

export async function listPaymentMethods(db: Db) {
  return db.select().from(paymentMethod);
}

export async function paymentMethodById(db: Db, id: number) {
  const rows = await db.select().from(paymentMethod).where(eq(paymentMethod.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function paymentMethodByOrderId(db: Db, orderId: number) {
  const rows = await db
    .select({ method: paymentMethod })
    .from(payment)
    .innerJoin(paymentMethod, eq(payment.methodId, paymentMethod.id))
    .where(eq(payment.orderId, orderId))
    .limit(1);
  return rows[0]?.method ?? null;
}

export async function savePaymentMethodActive(db: Db, methodId: number, active: boolean) {
  await db.update(paymentMethod).set({ active }).where(eq(paymentMethod.id, methodId));
  return paymentMethodById(db, methodId);
}

export async function countTodayOrders(db: Db) {
  const start = startOfTodayTaipeiSql();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orderTable)
    .where(sql`${orderTable.createdAt} >= ${start}`);
  return rows[0]?.c ?? 0;
}

export async function countTotalCustomers(db: Db) {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  return rows[0]?.c ?? 0;
}

export async function sumMonthlyIncome(db: Db) {
  const start = startOfMonthTaipeiSql();
  const rows = await db
    .select({
      total: sql<string>`coalesce(sum(${orderTable.totalAmount})::text, '0')`,
    })
    .from(orderTable)
    .where(sql`${orderTable.createdAt} >= ${start}`);
  return Number(rows[0]?.total ?? 0);
}

export async function countPendingOrders(db: Db) {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(orderTable);
  return rows[0]?.c ?? 0;
}

export async function storeDisplayByKey(db: Db, storeKey: string) {
  const rows = await db.select().from(storeDisplayConfig).where(eq(storeDisplayConfig.storeKey, storeKey)).limit(1);
  return rows[0] ?? null;
}

export async function insertStoreDisplay(db: Db, row: typeof storeDisplayConfig.$inferInsert) {
  const ins = await db.insert(storeDisplayConfig).values(row).returning();
  return ins[0]!;
}

export async function updateStoreDisplayRow(db: Db, id: number, patch: Partial<typeof storeDisplayConfig.$inferInsert>) {
  await db.update(storeDisplayConfig).set(patch).where(eq(storeDisplayConfig.id, id));
}

export async function markMessagesProcessed(db: Db, ids: number[]) {
  if (ids.length === 0) return;
  await db.update(chatMessage).set({ processed: true }).where(inArray(chatMessage.id, ids));
}

export async function wipeLineCustomerGraph(db: Db, roomId: number, userId: number) {
  const orderIds = await db.select({ id: orderTable.id }).from(orderTable).where(eq(orderTable.roomId, roomId));
  const ids = orderIds.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(payment).where(inArray(payment.orderId, ids));
  }
  await db.delete(orderTable).where(eq(orderTable.roomId, roomId));
  await db.delete(orderDraft).where(eq(orderDraft.roomId, roomId));
  await db.delete(chatMessage).where(eq(chatMessage.roomId, roomId));
  await db
    .delete(notification)
    .where(and(eq(notification.receiverType, "USER"), eq(notification.receiverId, userId)));
  await db.delete(chatRoom).where(eq(chatRoom.id, roomId));
  await db.delete(users).where(eq(users.id, userId));
}
