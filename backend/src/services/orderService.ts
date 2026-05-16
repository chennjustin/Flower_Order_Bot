import type { orders as OrderTable, orderDraft as orderDraftTable } from "../db/schema.js";
import type { InferSelectModel } from "drizzle-orm";
import * as repo from "../db/repositories.js";
import type { Db } from "../db/repositories.js";
import { HttpError } from "../lib/httpError.js";
import {
  incomingIsoToTaipeiNaiveSql,
  nowTaipeiNaiveSql,
  toTaipeiAwareIsoFromNaiveSql,
  weekdayEnglishFromNaiveSql,
} from "../utils/time.js";
import { linePushMessage } from "../utils/lineSend.js";

export type OrderRow = InferSelectModel<typeof OrderTable>;

export interface OrderOut {
  id: number;
  customer_name: string;
  customer_phone: string;
  receiver_name: string | null;
  receiver_phone: string | null;
  order_date: string;
  order_status: string;
  pay_way: string | null;
  total_amount: number;
  item: string;
  quantity: number;
  note: string | null;
  card_message: string | null;
  shipment_method: string;
  weekday: string;
  send_datetime: string | null;
  receipt_address: string | null;
  delivery_address: string;
}

export interface OrderDraftOut {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  order_date: string;
  pay_way: string | null;
  total_amount: number | null;
  item: string | null;
  quantity: number | null;
  note: string | null;
  card_message: string | null;
  shipment_method: string | null;
  weekday: string;
  send_datetime: string | null;
  receipt_address: string | null;
  delivery_address: string;
}

export type OrderDraftUpdateBody = Partial<{
  customer_name: string | null;
  customer_phone: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  total_amount: number | null;
  item: string | null;
  quantity: number | null;
  note: string | null;
  card_message: string | null;
  shipment_method: string | null;
  send_datetime: string | null;
  receipt_address: string | null;
  delivery_address: string | null;
  pay_way_id: number | null;
  pay_way: string | null;
}>;

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function payWayName(db: Db, orderOrDraftId: number): Promise<string | null> {
  const method = await repo.paymentMethodByOrderId(db, orderOrDraftId);
  return method?.displayName ?? null;
}

async function buildOrderOut(db: Db, order: OrderRow): Promise<OrderOut | null> {
  const user = await repo.userById(db, order.userId);
  const receiverUser = await repo.userById(db, order.receiverUserId);
  if (!user) {
    console.warn(`User not found for order ${order.id}`);
    return null;
  }
  const payWay = await payWayName(db, order.id);
  const deliveryAddr = order.deliveryAddress ?? order.receiptAddress ?? "";
  return {
    id: order.id,
    customer_name: user.name,
    customer_phone: user.phone ?? "",
    receiver_name: receiverUser?.name ?? user.name,
    receiver_phone: receiverUser?.phone ?? user.phone ?? "",
    order_date: toTaipeiAwareIsoFromNaiveSql(order.createdAt),
    order_status: order.status,
    pay_way: payWay,
    total_amount: num(order.totalAmount) ?? 0,
    item: order.itemType,
    quantity: order.quantity,
    note: order.notes,
    card_message: order.cardMessage,
    shipment_method: order.shipmentMethod,
    weekday: weekdayEnglishFromNaiveSql(order.createdAt),
    send_datetime: order.deliveryDatetime ? toTaipeiAwareIsoFromNaiveSql(order.deliveryDatetime) : null,
    receipt_address: order.receiptAddress,
    delivery_address: deliveryAddr,
  };
}

export async function getAllOrders(db: Db): Promise<OrderOut[]> {
  const rows = await repo.listActiveOrders(db);
  const results: OrderOut[] = [];
  for (const order of rows) {
    const out = await buildOrderOut(db, order);
    if (out) results.push(out);
  }
  results.sort((a, b) => b.id - a.id);
  return results;
}

async function validateDraftRequired(db: Db, draft: NonNullable<Awaited<ReturnType<typeof repo.latestOrderDraftByRoom>>>) {
  const missing: string[] = [];
  if (!draft.userId) missing.push("user_id");
  if (!draft.receiverUserId) missing.push("receiver_user_id");
  if (!draft.itemType) missing.push("item_type");
  if (draft.quantity == null || draft.quantity === 0) missing.push("quantity");
  const ta = draft.totalAmount != null ? Number(draft.totalAmount) : NaN;
  if (draft.totalAmount == null || draft.totalAmount === "" || ta === 0 || Number.isNaN(ta)) missing.push("total_amount");
  if (!draft.shipmentMethod) missing.push("shipment_method");

  const user = await repo.userById(db, draft.userId);
  if (!user) missing.push("user");
  else {
    if (!user.name) missing.push("user_name");
    if (!user.phone) missing.push("user_phone");
  }

  const recv = draft.receiverUserId ? await repo.userById(db, draft.receiverUserId) : null;
  if (!recv) missing.push("receiver");
  else {
    if (!recv.name) missing.push("receiver_name");
    if (!recv.phone) missing.push("receiver_phone");
  }
  return { ok: missing.length === 0, missing };
}

export async function createOrderByRoom(db: Db, roomId: number): Promise<string[]> {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) throw new HttpError(404, `Chat room with id ${roomId} not found.`);
  const draft = await repo.latestOrderDraftByRoom(db, roomId);
  if (!draft) throw new HttpError(404, `Order draft for room ${roomId} not found.`);
  const { ok, missing } = await validateDraftRequired(db, draft);
  if (!ok) return missing;

  const t = nowTaipeiNaiveSql();
  await repo.insertOrder(db, {
    roomId: draft.roomId,
    userId: draft.userId,
    receiverUserId: draft.receiverUserId!,
    status: "CONFIRMED",
    itemType: draft.itemType!,
    quantity: draft.quantity!,
    totalAmount: draft.totalAmount!,
    notes: draft.notes,
    cardMessage: draft.cardMessage,
    shipmentMethod: draft.shipmentMethod!,
    shipmentStatus: "PENDING",
    receiptAddress: draft.receiptAddress,
    deliveryAddress: draft.deliveryAddress,
    deliveryDatetime: draft.deliveryDatetime,
    createdAt: t,
    updatedAt: t,
  });

  await repo.updateChatRoomRow(db, joined.room.id, { stage: "ORDER_CONFIRM", updatedAt: t });
  console.log("聊天室，已設定成「訂單確認」模式");

  const lineUid = joined.user?.lineUid ?? null;
  const msg = "訂單已經由後台送出囉～\n\n";
  if (!lineUid) console.log("❗ 無法取得 LINE UID，無法推播訂單已送出提醒。");
  await linePushMessage(lineUid ?? undefined, msg);
  console.log("已傳送訊息: ", msg);

  await repo.insertChatMessage(db, {
    roomId: joined.room.id,
    direction: "OUTGOING_BY_BOT",
    text: "[自動回覆已傳送]" + msg,
    imageUrl: "",
    status: "PENDING",
    processed: true,
    createdAt: t,
    updatedAt: t,
  });

  return [];
}

export async function updateOrderByRoomId(db: Db, roomId: number): Promise<boolean> {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) throw new HttpError(404, `Chat room with id ${roomId} not found.`);
  const draft = await repo.latestOrderDraftByRoom(db, roomId);
  if (!draft) throw new HttpError(404, `Order draft for room ${roomId} not found.`);
  const v = await validateDraftRequired(db, draft);
  if (!v.ok) {
    throw new HttpError(400, `訂單草稿不完整，缺少以下欄位：${v.missing.join(", ")}`);
  }
  const order = await repo.latestConfirmedOrderByRoom(db, joined.room.id);
  if (!order) throw new HttpError(404, `No confirmed order found for room ${roomId}.`);

  const t = nowTaipeiNaiveSql();
  await repo.updateOrderFields(db, order.id, {
    userId: draft.userId,
    receiverUserId: draft.receiverUserId!,
    itemType: draft.itemType!,
    quantity: draft.quantity!,
    totalAmount: draft.totalAmount!,
    notes: draft.notes,
    cardMessage: draft.cardMessage,
    shipmentMethod: draft.shipmentMethod!,
    receiptAddress: draft.receiptAddress,
    deliveryAddress: draft.deliveryAddress,
    deliveryDatetime: draft.deliveryDatetime,
    updatedAt: t,
  });
  return true;
}

export async function deleteOrderById(db: Db, orderId: number): Promise<boolean> {
  const order = await repo.orderById(db, orderId);
  if (!order) throw new HttpError(404, `Order with id ${orderId} not found.`);
  await repo.updateOrderFields(db, order.id, { status: "CANCELLED", updatedAt: nowTaipeiNaiveSql() });
  return true;
}

export async function getOrderDraftOutByRoom(db: Db, roomId: number): Promise<OrderDraftOut | null> {
  const draft = await repo.latestOrderDraftByRoom(db, roomId);
  if (!draft) return null;
  const user = await repo.userById(db, draft.userId);
  const receiverUser = draft.receiverUserId ? await repo.userById(db, draft.receiverUserId) : null;
  const payWay = await payWayName(db, draft.id);
  const deliveryAddr = draft.deliveryAddress ?? draft.receiptAddress ?? "";
  return {
    id: draft.id,
    customer_name: user?.name ?? "未知",
    customer_phone: user?.phone ?? "未知",
    receiver_name: receiverUser?.name ?? user?.name ?? null,
    receiver_phone: receiverUser?.phone ?? user?.phone ?? null,
    order_date: toTaipeiAwareIsoFromNaiveSql(draft.createdAt),
    pay_way: payWay,
    total_amount: num(draft.totalAmount),
    item: draft.itemType,
    quantity: draft.quantity,
    note: draft.notes,
    card_message: draft.cardMessage,
    shipment_method: draft.shipmentMethod,
    weekday: weekdayEnglishFromNaiveSql(draft.createdAt),
    send_datetime: draft.deliveryDatetime ? toTaipeiAwareIsoFromNaiveSql(draft.deliveryDatetime) : null,
    receipt_address: draft.receiptAddress,
    delivery_address: deliveryAddr,
  };
}

export async function createOrderDraftByRoomId(db: Db, roomId: number) {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) throw new HttpError(404, `Chat room with id ${roomId} not found.`);
  const existing = await repo.latestOrderDraftByRoom(db, roomId);
  if (existing) throw new HttpError(400, `Order draft for room ${roomId} already exists.`);
  const uid = joined.room.userId;
  if (!uid) throw new HttpError(400, "Chat room has no user_id");
  const t = nowTaipeiNaiveSql();
  return repo.insertOrderDraft(db, {
    roomId: joined.room.id,
    userId: uid,
    receiverUserId: uid,
    createdAt: t,
    updatedAt: t,
  });
}

export async function updateOrderDraftByRoomId(db: Db, roomId: number, draftIn: OrderDraftUpdateBody): Promise<OrderDraftOut> {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) throw new HttpError(404, `Chat room with id ${roomId} not found.`);
  const draft = await repo.latestOrderDraftByRoom(db, roomId);
  if (!draft) throw new HttpError(404, `Order draft with room id ${roomId} not found.`);

  const t = nowTaipeiNaiveSql();

  if (draftIn.customer_name != null || draftIn.customer_phone != null) {
    const user = await repo.userById(db, draft.userId);
    if (!user) throw new HttpError(404, `User with id ${draft.userId} not found.`);
    await repo.updateUserRow(db, user.id, {
      name: draftIn.customer_name ?? user.name,
      phone: draftIn.customer_phone ?? user.phone,
      updatedAt: t,
    });
  }

  if (draftIn.receiver_name || draftIn.receiver_phone) {
    const recv = await repo.insertUser(db, {
      name: draftIn.receiver_name ?? "",
      phone: draftIn.receiver_phone ?? null,
      lineUid: null,
      avatarUrl: null,
      hasOrdered: false,
      createdAt: t,
      updatedAt: t,
    });
    await repo.updateOrderDraftRow(db, draft.id, { receiverUserId: recv.id });
    draft.receiverUserId = recv.id;
  }

  const patch: Partial<Omit<typeof orderDraftTable.$inferInsert, "id">> = { updatedAt: t };
  if (draftIn.item != null) patch.itemType = draftIn.item;
  if (draftIn.quantity != null) patch.quantity = draftIn.quantity;
  if (draftIn.total_amount != null) patch.totalAmount = String(draftIn.total_amount);
  if (draftIn.note != null) patch.notes = draftIn.note;
  if (draftIn.card_message != null) patch.cardMessage = draftIn.card_message;
  if (draftIn.shipment_method != null) patch.shipmentMethod = draftIn.shipment_method as typeof draft.shipmentMethod;
  if (draftIn.send_datetime != null) patch.deliveryDatetime = incomingIsoToTaipeiNaiveSql(new Date(draftIn.send_datetime));
  if (draftIn.receipt_address != null) patch.receiptAddress = draftIn.receipt_address;
  if (draftIn.delivery_address != null) patch.deliveryAddress = draftIn.delivery_address;

  await repo.updateOrderDraftRow(db, draft.id, patch);

  if (draftIn.pay_way_id) {
    const payWay = await repo.paymentMethodById(db, draftIn.pay_way_id);
    if (!payWay) throw new HttpError(400, `Payment method with id ${draftIn.pay_way_id} not found.`);
    // Python assigns pay_way_id on ORM without DB column — skipped here.
  }

  const out = await getOrderDraftOutByRoom(db, roomId);
  return out!;
}

export async function exportOrderForDocx(db: Db, orderId: number): Promise<OrderOut | null> {
  const list = await getAllOrders(db);
  return list.find((o) => o.id === orderId) ?? null;
}
