import type { Message } from "@line/bot-sdk";
import { getLineClient } from "../deps.js";

export async function linePushMessage(lineUid: string | null | undefined, text?: string | null, imageUrl?: string | null) {
  if (!lineUid) return false;
  const api = getLineClient();
  const messages: Message[] = [];
  if (text) {
    messages.push({ type: "text", text });
  } else if (imageUrl) {
    messages.push({
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    });
  } else {
    return false;
  }
  try {
    await api.pushMessage(lineUid, messages);
    return true;
  } catch (e) {
    console.error("[LINE PUSH]", e);
    return false;
  }
}

export async function replyTextMessage(replyToken: string, text: string) {
  const api = getLineClient();
  await api.replyMessage(replyToken, [{ type: "text", text }]);
}

export async function sendQuickReplyMessage(replyToken: string, text: string, options: string[]) {
  const api = getLineClient();
  await api.replyMessage(replyToken, [
    {
      type: "text",
      text,
      quickReply: {
        items: options.map((opt) => ({
          type: "action",
          action: {
            type: "message",
            label: opt,
            text: opt,
          },
        })),
      },
    },
  ]);
}

export async function sendConfirm(
  replyToken: string,
  text: string,
  yesTxt = "是",
  noTxt = "否",
  yesReply = "yes",
  noReply = "no",
) {
  const api = getLineClient();
  await api.replyMessage(replyToken, [
    {
      type: "template",
      altText: text,
      template: {
        type: "confirm",
        text,
        actions: [
          { type: "message", label: yesTxt, text: yesReply },
          { type: "message", label: noTxt, text: noReply },
        ],
      },
    },
  ]);
}
