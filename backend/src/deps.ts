import OpenAI from "openai";
import { Client } from "@line/bot-sdk";
import { getSettings } from "./config/settings.js";

let openai: OpenAI | undefined;
let lineClient: Client | undefined;

export function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: getSettings().openaiApiKey });
  }
  return openai;
}

export function getLineClient(): Client {
  if (!lineClient) {
    const token = getSettings().lineChannelAccessToken;
    if (!token) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
    }
    lineClient = new Client({ channelAccessToken: token });
  }
  return lineClient;
}

export function resetSingletonClients(): void {
  openai = undefined;
  lineClient = undefined;
}
