import fs from "node:fs";
import path from "node:path";

export class PromptManager {
  constructor(private readonly promptDir: string) {}

  loadPrompt(name: string, kwargs: Record<string, string>): string {
    const filePath = path.join(this.promptDir, `${name}.txt`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }
    const template = fs.readFileSync(filePath, "utf8");
    let out = template;
    for (const [key, val] of Object.entries(kwargs)) {
      const marker = `{${key}}`;
      if (!out.includes(marker)) {
        throw new Error(`Missing parameter for prompt: ${key}`);
      }
      out = out.split(marker).join(val);
    }
    return out;
  }
}

export function defaultPromptManager(): PromptManager {
  return new PromptManager(path.join(process.cwd(), "prompts"));
}
