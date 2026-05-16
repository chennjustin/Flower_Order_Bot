import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { validateSignature } from "@line/bot-sdk";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Db } from "./db/repositories.js";
import { getSettings } from "./config/settings.js";
import { HttpError } from "./lib/httpError.js";
import {
  createOrderByRoom,
  deleteOrderById,
  getAllOrders,
  getOrderDraftOutByRoom,
  updateOrderByRoomId,
  updateOrderDraftByRoomId,
} from "./services/orderService.js";
import {
  createStaffMessage,
  getChatMessages,
  getChatRoomList,
  switchChatRoomMode,
} from "./services/messageService.js";
import {
  getAllPaymentMethods,
  getPaymentMethodById,
  togglePaymentMethodActive,
} from "./services/paymentService.js";
import { getStats } from "./services/statsService.js";
import {
  getOrInitStoreDisplayFields,
  getVisibleOrderDraftPayload,
  updateStoreDisplayFields,
} from "./services/storeDisplayService.js";
import { organizeData } from "./services/organizeDataService.js";
import { generateFakeData } from "./services/fakeDataService.js";
import { handleFollowEvent, handleIncomingTextMessage } from "./usecases/linebotFlow.js";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import fs from "node:fs";
import path from "node:path";
import { weekdayEnglishFromNaiveSql, toTaipeiAwareIsoFromNaiveSql } from "./utils/time.js";

export async function buildApp(db: Db) {
  const app = Fastify({ logger: false });

  app.decorate("db", db);

  app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 12 * 1024 * 1024 }, (req, body, done) => {
    try {
      const raw = body.toString("utf8");
      (req as FastifyRequest & { rawBody?: string }).rawBody = raw;
      const json = raw === "" ? {} : JSON.parse(raw);
      done(null, json);
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const origin = request.headers.origin;
    if (origin && !reply.getHeader("access-control-allow-origin")) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-methods", "*");
      reply.header("access-control-allow-headers", "*");
    }
    return payload;
  });

  await app.register(cors, { origin: "*", credentials: false });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "花店自動化系統 API Dashboard", version: "2.0.0" },
    },
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof HttpError) {
      reply.code(err.statusCode).send(err.body ?? { detail: err.message });
      return;
    }
    console.error(err);
    reply.code(500).send({ detail: "Internal Server Error" });
  });

  app.get("/health", { schema: { tags: ["Health"], response: { 200: { type: "string" } } } }, async (_req, reply: FastifyReply) => {
    reply.type("text/plain").send("OK");
  });

  app.get("/orders", async () => getAllOrders(app.db));

  app.delete("/order/:order_id", async (req) =>
    deleteOrderById(app.db, Number((req.params as { order_id: string }).order_id)),
  );

  app.post("/order/:room_id", async (req) => createOrderByRoom(app.db, Number((req.params as { room_id: string }).room_id)));

  app.patch("/order/:room_id", async (req) => updateOrderByRoomId(app.db, Number((req.params as { room_id: string }).room_id)));

  app.get("/orderdraft/:room_id", async (req) => getOrderDraftOutByRoom(app.db, Number((req.params as { room_id: string }).room_id)));

  app.patch("/orderdraft/:room_id", async (req) =>
    updateOrderDraftByRoomId(app.db, Number((req.params as { room_id: string }).room_id), req.body as never),
  );

  app.patch("/organize_data/:room_id", async (req, reply) => {
    const roomId = Number((req.params as { room_id: string }).room_id);
    const result = await organizeData(app.db, roomId);
    if (!result) {
      reply.code(404).send({ detail: "No data found" });
      return;
    }
    return result;
  });

  app.get("/chat_rooms", async () => getChatRoomList(app.db));

  app.get("/chat_rooms/:room_id/messages", async (req) => {
    const q = req.query as { after?: string };
    return getChatMessages(app.db, Number((req.params as { room_id: string }).room_id), q.after ?? undefined);
  });

  app.post("/chat_rooms/:room_id/messages", async (req) =>
    createStaffMessage(app.db, Number((req.params as { room_id: string }).room_id), req.body as never),
  );

  app.post("/chat_rooms/:room_id/switch_mode", async (req) => {
    const mode = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const cleaned = mode.replace(/^"|"$/g, "");
    await switchChatRoomMode(app.db, Number((req.params as { room_id: string }).room_id), cleaned);
    return { message: "success" };
  });

  app.get("/stats", async () => getStats(app.db));

  app.get("/payment_methods", async () => getAllPaymentMethods(app.db));

  app.patch("/payment_methods/:payment_method_id", async (req) =>
    togglePaymentMethodActive(app.db, Number((req.params as { payment_method_id: string }).payment_method_id)),
  );

  app.get("/payment_methods/:payment_method_id", async (req, reply) => {
    const id = Number((req.params as { payment_method_id: string }).payment_method_id);
    const pm = await getPaymentMethodById(app.db, id);
    if (!pm) {
      reply.code(404).send({ detail: "Payment method not found" });
      return;
    }
    return pm;
  });

  app.get("/generate-fake-data", async (req, reply) => {
    const q = req.query as { count?: string };
    const count = q.count ? Number(q.count) : 10;
    await generateFakeData(app.db, count);
    reply.type("text/plain").send("OK");
  });

  app.get("/stores/:store_key/display-fields", async (req) =>
    getOrInitStoreDisplayFields(app.db, (req.params as { store_key: string }).store_key),
  );

  app.put("/stores/:store_key/display-fields", async (req) => {
    const { store_key } = req.params as { store_key: string };
    const body = req.body as { visible_fields: string[]; updated_by_staff_id?: number | null };
    return updateStoreDisplayFields(app.db, store_key, body.visible_fields, body.updated_by_staff_id);
  });

  app.get("/stores/:store_key/orderdraft/:room_id/visible", async (req) => {
    const { store_key, room_id } = req.params as { store_key: string; room_id: string };
    return getVisibleOrderDraftPayload(app.db, store_key, Number(room_id));
  });

  app.get("/orders/:order_id.docx", async (req, reply) => {
    const orderId = Number((req.params as { order_id: string }).order_id);
    const orders = await getAllOrders(app.db);
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      reply.code(200).send({ error: "Order not found" });
      return;
    }

    let send_datetime_str = "";
    let weekday_str = "";
    if (order.send_datetime) {
      send_datetime_str = order.send_datetime.slice(0, 16).replace("T", " ");
      const map: Record<string, string> = {
        Monday: "星期一",
        Tuesday: "星期二",
        Wednesday: "星期三",
        Thursday: "星期四",
        Friday: "星期五",
        Saturday: "星期六",
        Sunday: "星期日",
      };
      const dayEn = new Date(order.send_datetime).toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Taipei" });
      weekday_str = map[dayEn] ?? "";
    }

    const tplPath = path.join(process.cwd(), "docs", "order_template.docx");
    if (!fs.existsSync(tplPath)) {
      reply.code(500).send({ detail: "DOCX template not found" });
      return;
    }

    const zip = new PizZip(fs.readFileSync(tplPath));
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.setData({
      customer_name: order.customer_name,
      phone: order.customer_phone,
      timestamp: order.order_date.slice(0, 10),
      receipt_address: order.receipt_address ?? "",
      item: order.item,
      quantity: order.quantity,
      pay_way: order.pay_way ?? "",
      note: order.note,
      card_message: order.card_message ?? "",
      weekday: weekday_str,
      send_datetime: send_datetime_str,
      receiver_name: order.receiver_name ?? "",
      receiver_phone: order.receiver_phone ?? "",
      delivery_address: order.delivery_address ?? "",
      total_amount: order.total_amount,
    });
    doc.render();
    const buf = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    reply.header("Content-Disposition", `attachment; filename=order_${orderId}.docx`);
    return reply.send(buf);
  });

  app.post("/callback", async (req, reply) => {
    const settings = getSettings();
    const secret = settings.lineChannelSecret;
    if (!secret) {
      reply.code(500).send("LINE_CHANNEL_SECRET missing");
      return;
    }
    const signature = req.headers["x-line-signature"];
    if (!signature || typeof signature !== "string") {
      reply.code(400).send("Missing X-Line-Signature header");
      return;
    }
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody;
    if (!raw) {
      reply.code(400).send("Missing raw body");
      return;
    }
    if (!validateSignature(raw, secret, signature)) {
      reply.code(400).send("Invalid signature");
      return;
    }
    const body = req.body as { events?: unknown[] };
    const events = Array.isArray(body.events) ? body.events : [];
    for (const ev of events as Record<string, unknown>[]) {
      const type = ev.type as string | undefined;
      const replyToken = (ev.replyToken as string) ?? "";
      const src = ev.source as { userId?: string } | undefined;
      const uid = src?.userId;
      if (!uid) continue;
      if (type === "message") {
        const msg = ev.message as { type?: string; text?: string } | undefined;
        if (msg?.type === "text" && msg.text) {
          await handleIncomingTextMessage(app.db, uid, msg.text, replyToken);
        }
      } else if (type === "follow") {
        await handleFollowEvent(app.db, uid, replyToken);
      }
    }
    reply.type("text/plain").send("OK");
  });

  app.get("/openapi.json", async (_request, reply) => {
    reply.send(app.swagger());
  });

  await app.register(swaggerUi, {
    routePrefix: "/",
    uiConfig: { docExpansion: "list", deepLinking: false },
    staticCSP: true,
  });

  return app;
}
