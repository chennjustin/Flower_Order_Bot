import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";
import { getSettings } from "../config/settings.js";
import { wipeLineCustomerForDev } from "../services/devRoomReset.js";
import { createChatRoom, getChatRoomByUserId, getLatestMessage } from "../services/messageService.js";
import { createOrderDraftByRoomId } from "../services/orderService.js";
import * as userService from "../services/userService.js";
import { fetchUserProfile } from "../utils/lineProfile.js";
import { replyTextMessage, sendConfirm, sendQuickReplyMessage } from "../utils/lineSend.js";
import { formatTaipeiNaiveSql, nowTaipeiNaiveSql } from "../utils/time.js";

type HandlerResult = readonly [number, boolean, boolean];

function thresholdWeekAgoSql(): string {
  const ms = Date.now() - 7 * 24 * 3600 * 1000;
  return formatTaipeiNaiveSql(new Date(ms));
}

export async function handleIncomingTextMessage(db: Db, lineUserId: string, userText: string, replyToken: string) {
  let user = await userService.getUserByLineUid(db, lineUserId);
  if (!user) {
    user = await userService.createUser(db, lineUserId, "Unknown User");
  }

  if (user.name === "Unknown User" || user.avatarUrl == null) {
    try {
      const profile = await fetchUserProfile(lineUserId);
      if (profile) {
        await userService.updateUserInfo(db, user.id, profile.displayName, user.phone);
        await repo.updateUserRow(db, user.id, {
          avatarUrl: profile.pictureUrl ?? "",
          updatedAt: nowTaipeiNaiveSql(),
        });
        user = (await userService.getUserById(db, user.id))!;
      }
    } catch (e) {
      console.log("Error fetching user profile", e);
    }
  }

  let joined = await getChatRoomByUserId(db, user.id);
  if (!joined) {
    const room = await createChatRoom(db, user.id);
    joined = await getChatRoomByUserId(db, user.id);
    console.log(`新聊天室已創建，使用者 ${lineUserId} 的聊天室 ID：${room.id}`);
  }
  if (!joined) return;

  const latestMsg = await getLatestMessage(db, joined.room.id);
  const oneWeekAgo = thresholdWeekAgoSql();
  if (latestMsg && latestMsg.created_at < oneWeekAgo) {
    await repo.updateChatRoomRow(db, joined.room.id, {
      stage: "WELCOME",
      botStep: -1,
      updatedAt: nowTaipeiNaiveSql(),
    });
    console.log("上次傳訊息是很久以前，已重設成 welcome");
    joined = (await getChatRoomByUserId(db, user.id))!;
  }

  const draft = await repo.latestOrderDraftByRoom(db, joined.room.id);
  if (!draft) {
    await createOrderDraftByRoomId(db, joined.room.id);
  }

  const settings = getSettings();
  if (settings.lineTestResetPhrase && userText.trim() === settings.lineTestResetPhrase) {
    await wipeLineCustomerForDev(db, joined.room.id, user.id);
    console.log(`[dev] LINE_TEST_RESET_PHRASE matched; wiped room=${joined.room.id} user=${user.id}`);
    try {
      await replyTextMessage(replyToken, "【開發用】已清除此聊天室與顧客資料，可重新傳訊開始。");
    } catch (e) {
      console.log("[dev] LINE_TEST_RESET_PHRASE 回覆提示失敗：", e);
    }
    return;
  }

  const t = nowTaipeiNaiveSql();
  await repo.insertChatMessage(db, {
    roomId: joined.room.id,
    direction: "INCOMING",
    text: userText,
    imageUrl: "",
    status: "PENDING",
    processed: false,
    createdAt: t,
    updatedAt: t,
    lineMsgId: null,
  });

  console.log(`User ${lineUserId} 發送訊息：${userText}`);

  joined = (await getChatRoomByUserId(db, user.id))!;
  let room = joined.room;

  if (userText === "Again") {
    await repo.updateChatRoomRow(db, room.id, {
      stage: "WELCOME",
      botStep: -1,
      updatedAt: nowTaipeiNaiveSql(),
    });
    console.log("回到 welcome");
    return;
  }

  if (room.stage === "WELCOME") {
    await runWelcomeFlow(db, room.id, userText, replyToken);
    joined = (await getChatRoomByUserId(db, user.id))!;
    room = joined.room;
    if (room.stage === "BOT_ACTIVE") {
      await runBotFlow(db, room.id, "", replyToken);
    }
    return;
  }

  if (room.stage === "BOT_ACTIVE") {
    await runBotFlow(db, room.id, userText, replyToken);
    return;
  }

  if (room.stage === "ORDER_CONFIRM") {
    await repo.updateChatRoomRow(db, room.id, {
      stage: "WAITING_OWNER",
      botStep: -1,
      updatedAt: nowTaipeiNaiveSql(),
    });
    console.log("訂單確認後出現訊息，轉交「人工回覆」模式。");
  }
}

async function runWelcomeFlow(db: Db, roomId: number, userText: string, replyToken: string) {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) return;
  const room = joined.room;

  if (room.botStep === -1) {
    await sendConfirm(
      replyToken,
      "您好，歡迎來到奇美花店，若想要訂購客製化花束，請按「是」~",
      "是",
      "否",
      "啟動智慧訂購流程",
      "直接轉接老闆",
    );

    const t = nowTaipeiNaiveSql();
    await repo.insertChatMessage(db, {
      roomId,
      direction: "OUTGOING_BY_BOT",
      text: "[自動回覆已傳送] 詢問是否要訂購客製化花束。",
      imageUrl: "",
      status: "PENDING",
      processed: false,
      createdAt: t,
      updatedAt: t,
      lineMsgId: null,
    });

    await repo.updateChatRoomRow(db, roomId, { botStep: 0, updatedAt: t });
    console.log("已詢問使用者是否要客製化花束");
    return;
  }

  const t = nowTaipeiNaiveSql();
  if (userText === "啟動智慧訂購流程") {
    await repo.updateChatRoomRow(db, roomId, {
      stage: "BOT_ACTIVE",
      botStep: 1,
      updatedAt: t,
    });
  } else {
    await repo.updateChatRoomRow(db, roomId, {
      stage: "WAITING_OWNER",
      botStep: -1,
      updatedAt: t,
    });
    await replyTextMessage(replyToken, "好的！已轉交給客服人員，請稍候。");

    await repo.insertChatMessage(db, {
      roomId,
      direction: "OUTGOING_BY_BOT",
      text: "[自動回覆已傳送] 好的！已轉交給客服人員，請稍候。",
      imageUrl: "",
      status: "PENDING",
      processed: false,
      createdAt: t,
      updatedAt: t,
      lineMsgId: null,
    });
  }

  await repo.updateChatRoomRow(db, roomId, { updatedAt: nowTaipeiNaiveSql() });
}

async function insertBotQuickReplyRecord(db: Db, roomId: number, summary: string) {
  const t = nowTaipeiNaiveSql();
  await repo.insertChatMessage(db, {
    roomId,
    direction: "OUTGOING_BY_BOT",
    text: `[自動回覆已傳送] ${summary}`,
    imageUrl: "",
    status: "PENDING",
    processed: false,
    createdAt: t,
    updatedAt: t,
    lineMsgId: null,
  });
}

async function askBudget(userText: string, replyToken: string, db: Db, roomId: number): Promise<HandlerResult> {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) return [-1, false, false];
  const room = joined.room;
  if (room.botStep === 1) {
    if (userText.trim() === "") {
      await sendQuickReplyMessage(replyToken, "好的～請問預算大概多少呢？", ["500以下", "500-1000", "1000以上"]);
      await insertBotQuickReplyRecord(db, roomId, "詢問預算金額。");
      return [1, false, false];
    }
    const budget = userText.trim();
    if (budget === "500以下") return [2, false, true];
    return [3, false, true];
  }
  return [-1, false, false];
}

async function askColor(_userText: string, replyToken: string, db: Db, roomId: number): Promise<HandlerResult> {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) return [-1, false, false];
  const room = joined.room;
  if (room.botStep === 2) {
    await sendQuickReplyMessage(replyToken, "請問想要什麼顏色的客製化花束？", ["紅", "白", "粉", "其他"]);
    await insertBotQuickReplyRecord(db, roomId, "詢問顏色。");
    return [4, false, false];
  }
  return [-1, false, false];
}

async function askType(_userText: string, replyToken: string, db: Db, roomId: number): Promise<HandlerResult> {
  const joined = await repo.chatRoomJoinedById(db, roomId);
  if (!joined) return [-1, false, false];
  const room = joined.room;
  if (room.botStep === 3) {
    await sendQuickReplyMessage(replyToken, "請問想要什麼類型的花材？", ["玫瑰花", "滿天星", "向日葵", "其他"]);
    await insertBotQuickReplyRecord(db, roomId, "詢問花材。");
    return [4, false, false];
  }
  return [-1, false, false];
}

async function lastStep(_userText: string, replyToken: string, db: Db, roomId: number): Promise<HandlerResult> {
  await replyTextMessage(replyToken, "👌了解！已記錄到後臺～接下來會交由老闆與您聯繫確認細節。");
  await insertBotQuickReplyRecord(db, roomId, "👌了解！已記錄到後臺～接下來會交由老闆與您聯繫確認細節。");
  return [-1, false, false];
}

export async function runBotFlow(db: Db, roomId: number, text: string, replyToken: string) {
  const STEP_MAP: Record<number, typeof askBudget> = {
    1: askBudget,
    2: askColor,
    3: askType,
    4: lastStep,
  };

  let userText = text;
  while (true) {
    const joined = await repo.chatRoomJoinedById(db, roomId);
    if (!joined) return;
    const room = joined.room;
    const handler = STEP_MAP[room.botStep];
    if (!handler) {
      console.log(`Error: No handler for bot_step ${room.botStep}, reset bot_step to 0`);
      await repo.updateChatRoomRow(db, roomId, {
        botStep: 0,
        stage: "WAITING_OWNER",
        updatedAt: nowTaipeiNaiveSql(),
      });
      return;
    }

    const [nextStep, manualOverride, continueLoop] = await handler(userText, replyToken, db, roomId);

    let stage = room.stage;
    let botStep = nextStep;
    if (manualOverride) {
      stage = "WAITING_OWNER";
      botStep = -1;
    } else {
      botStep = nextStep;
      if (nextStep === -1) stage = "WAITING_OWNER";
    }

    await repo.updateChatRoomRow(db, roomId, {
      botStep,
      stage,
      updatedAt: nowTaipeiNaiveSql(),
    });

    if (!continueLoop) break;
    userText = "";
  }
}

export async function handleFollowEvent(db: Db, lineUserId: string, replyToken: string) {
  let user = await userService.getUserByLineUid(db, lineUserId);
  if (!user) {
    user = await userService.createUser(db, lineUserId, "Profile Name");
    console.log(`新使用者 ${lineUserId} 已創建`);
  } else {
    console.log(`使用者 ${lineUserId} 已存在`);
  }

  let joined = await getChatRoomByUserId(db, user.id);
  if (!joined) {
    await createChatRoom(db, user.id);
    joined = await getChatRoomByUserId(db, user.id);
    console.log(`新聊天室已創建，使用者 ${lineUserId} 的聊天室 ID：${joined?.room.id}`);
  }

  console.log("開始自動回覆流程");
  if (joined) {
    await runBotFlow(db, joined.room.id, "", replyToken);
  }
}
