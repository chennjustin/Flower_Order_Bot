import { completeSystemPrompt } from "../adapters/openaiChat.js";
import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";
import { HttpError } from "../lib/httpError.js";
import { defaultPromptManager } from "../managers/promptManager.js";
import {
  createOrderDraftByRoomId,
  getOrderDraftOutByRoom,
  updateOrderDraftByRoomId,
  type OrderDraftUpdateBody,
} from "../services/orderService.js";
import { getLineUidByChatroomId } from "../services/userService.js";
import { linePushMessage } from "../utils/lineSend.js";
import { nowTaipeiNaiveSql } from "../utils/time.js";

const promptManager = defaultPromptManager();

function cleanParsedReply(parsed: Record<string, unknown>) {
  for (const key of Object.keys(parsed)) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim() === "") parsed[key] = null;
  }
  return parsed;
}

export function parseOrderDraftJson(gptReply: string): OrderDraftUpdateBody | null {
  if (!gptReply?.trim()) return null;
  const parsed = cleanParsedReply(JSON.parse(gptReply) as Record<string, unknown>);
  const sendIso =
    typeof parsed.send_datetime === "string" && parsed.send_datetime ? parsed.send_datetime : null;
  return {
    customer_name: typeof parsed.customer_name === "string" ? parsed.customer_name : null,
    customer_phone: typeof parsed.customer_phone === "string" ? parsed.customer_phone : null,
    receiver_name: typeof parsed.receiver_name === "string" ? parsed.receiver_name : null,
    receiver_phone: typeof parsed.receiver_phone === "string" ? parsed.receiver_phone : null,
    pay_way: typeof parsed.pay_way === "string" ? parsed.pay_way : null,
    total_amount: typeof parsed.total_amount === "number" ? parsed.total_amount : null,
    item: typeof parsed.item === "string" ? parsed.item : null,
    quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
    note: typeof parsed.note === "string" ? parsed.note : null,
    card_message: typeof parsed.card_message === "string" ? parsed.card_message : null,
    shipment_method:
      typeof parsed.shipment_method === "string" ? (parsed.shipment_method as OrderDraftUpdateBody["shipment_method"]) : null,
    send_datetime: sendIso,
    receipt_address: typeof parsed.receipt_address === "string" ? parsed.receipt_address : null,
    delivery_address: typeof parsed.delivery_address === "string" ? parsed.delivery_address : null,
  };
}

export async function organizeOrderDraft(db: Db, chatRoomId: number) {
  const joined = await repo.chatRoomJoinedById(db, chatRoomId);
  if (!joined) throw new HttpError(404, "找不到聊天室");

  let draftOut = await getOrderDraftOutByRoom(db, joined.room.id);
  if (!draftOut) {
    await createOrderDraftByRoomId(db, joined.room.id);
    draftOut = await getOrderDraftOutByRoom(db, joined.room.id);
  }

  const messages = await repo.listChatMessages(db, chatRoomId);
  const pending = messages.filter((m) => !m.processed);
  const combinedText = [...pending]
    .reverse()
    .map((m) => `[${m.createdAt}] ${m.text} ${m.direction}`)
    .join("\n");

  const draftDump = JSON.stringify(JSON.stringify(draftOut ?? {}));
  const gptPrompt = promptManager.loadPrompt("order_prompt", {
    user_message: combinedText,
    order_draft: draftDump,
  });
  console.log("🔍 GPT 處理中...");
  console.log(`📜 GPT Prompt:\n${gptPrompt}`);

  const gptReply = await completeSystemPrompt(gptPrompt, "gpt-4.1", 0);
  console.log("🔍 GPT 處理完成");
  console.log(`💬 GPT 回覆:\n${gptReply}`);

  const orderDraftUpdate = parseOrderDraftJson(gptReply);
  if (!orderDraftUpdate) {
    console.log("❗ GPT 回覆為空，無法解析");
    return null;
  }
  console.log(orderDraftUpdate);

  const required_fields: Record<string, string> = {
    customer_name: "顧客姓名",
    customer_phone: "顧客電話",
    receiver_name: "收件人姓名",
    receiver_phone: "收件人電話",
    pay_way: "付款方式",
    total_amount: "總金額",
    item: "商品項目",
    quantity: "數量",
    shipment_method: "配送方式",
    send_datetime: "送達時間",
    delivery_address: "收件地址",
  };

  const missing: string[] = [];
  for (const [field, label] of Object.entries(required_fields)) {
    const v = orderDraftUpdate[field as keyof OrderDraftUpdateBody];
    if (v === null || v === undefined || v === "" || v === 0) missing.push(label);
  }

  if (missing.length > 0) {
    const warningMsg =
      "智慧客服已根據對話內容整理好訂單草稿囉！" +
      "我們發現了一些缺少的資料，請幫我們直接在下方補上～\n" +
      missing.map((f) => `- ${f}`).join("\n");
    console.log(warningMsg);

    const line_uid = await getLineUidByChatroomId(db, joined.room.id);
    if (!line_uid) console.log("❗ 無法取得 LINE UID，無法推播缺漏提醒。");
    await linePushMessage(line_uid ?? undefined, warningMsg);

    const t = nowTaipeiNaiveSql();
    await repo.insertChatMessage(db, {
      roomId: joined.room.id,
      direction: "OUTGOING_BY_BOT",
      text: "[自動回覆已傳送]" + warningMsg,
      imageUrl: "",
      status: "PENDING",
      processed: true,
      createdAt: t,
      updatedAt: t,
    });
  }

  const finalDraft = await updateOrderDraftByRoomId(db, joined.room.id, orderDraftUpdate);
  await repo.markMessagesProcessed(
    db,
    pending.map((m) => m.id),
  );
  return finalDraft;
}
