import { getOpenAI } from "../deps.js";

export async function completeSystemPrompt(
  prompt: string,
  model = "gpt-4.1",
  temperature = 0,
): Promise<string> {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: prompt }],
    temperature,
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}
