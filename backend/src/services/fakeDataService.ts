import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";
import { nowTaipeiNaiveSql } from "../utils/time.js";

let serialOffset = 0;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rndFloat(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function fakeZhName() {
  const names = ["王小明", "李小華", "陳美玲", "張志強", "林雅婷"];
  return names[rnd(0, names.length - 1)]!;
}

function fakePhone() {
  return `09${rnd(10000000, 99999999)}`;
}

function fakeSentence() {
  return `測試句子-${rnd(1, 99999)}`;
}

async function createRandomUser(db: Db, serialNumber: number) {
  const t = nowTaipeiNaiveSql();
  const user = await repo.insertUser(db, {
    lineUid: crypto.randomUUID(),
    name: fakeZhName(),
    phone: fakePhone(),
    hasOrdered: false,
    avatarUrl: `https://picsum.photos/seed/${serialNumber}/200/200`,
    createdAt: t,
    updatedAt: t,
  });

  const room = await repo.insertChatRoom(db, {
    userId: user.id,
    stage: "WELCOME",
    botStep: -1,
    unreadCount: rnd(0, 5),
    lastMessageTs: t,
    createdAt: t,
    updatedAt: t,
  });

  await repo.insertOrderDraft(db, {
    roomId: room.id,
    userId: user.id,
    receiverUserId: user.id,
    createdAt: t,
    updatedAt: t,
  });

  return { user, room };
}

async function createRandomMessage(db: Db, roomId: number) {
  let cursor = nowTaipeiNaiveSql();
  await repo.insertChatMessage(db, {
    roomId,
    status: "SENT",
    direction: "OUTGOING_BY_BOT",
    text: "您好！歡迎使用我們的訂花服務，請問有什麼可以協助您的嗎？",
    imageUrl: "",
    processed: false,
    createdAt: cursor,
    updatedAt: cursor,
    lineMsgId: null,
  });

  for (let i = 0; i < rnd(3, 7); i++) {
    const dirs = ["INCOMING", "OUTGOING_BY_BOT", "OUTGOING_BY_STAFF"] as const;
    const direction = dirs[rnd(0, 2)]!;
    let text = fakeSentence();
    if (direction === "OUTGOING_BY_BOT") text = "好的，我已經記錄下來了。";
    if (direction === "OUTGOING_BY_STAFF") text = "您好，我是客服人員。";
    cursor = nowTaipeiNaiveSql();
    await repo.insertChatMessage(db, {
      roomId,
      status: "SENT",
      direction,
      text,
      imageUrl: null,
      processed: false,
      createdAt: cursor,
      updatedAt: cursor,
      lineMsgId: null,
    });
  }

  await repo.updateChatRoomRow(db, roomId, { lastMessageTs: cursor, updatedAt: cursor });
}

async function createRandomOrder(db: Db, userId: number, roomId: number) {
  const total = rndFloat(1000, 3000);
  const quantity = rnd(1, 5);
  const item_type = rnd(0, 1) === 0 ? "花束" : "盆花";
  const shipment_method = rnd(0, 1) === 0 ? "STORE_PICKUP" : "DELIVERY";
  const t = nowTaipeiNaiveSql();
  await repo.insertOrder(db, {
    roomId,
    userId,
    receiverUserId: userId,
    status: "CONFIRMED",
    itemType: item_type,
    quantity,
    notes: fakeSentence(),
    cardMessage: fakeSentence(),
    totalAmount: String(total),
    shipmentMethod: shipment_method,
    shipmentStatus: "PENDING",
    receiptAddress: shipment_method === "DELIVERY" ? fakeSentence() : null,
    deliveryAddress: shipment_method === "DELIVERY" ? fakeSentence() : null,
    deliveryDatetime: t,
    createdAt: t,
    updatedAt: t,
  });
}

export async function generateFakeData(db: Db, count = 10) {
  for (let i = 0; i < count; i++) {
    const sn = serialOffset + i + 1;
    const { user, room } = await createRandomUser(db, sn);
    await createRandomMessage(db, room.id);
    await createRandomOrder(db, user.id, room.id);
  }
  serialOffset += count;
  console.log("✅ 測試資料產生完畢");
}
