import type { AIProvider, CompletionRequest } from "../provider";

const API_URL = "https://api.anthropic.com/v1/messages";
// Internal default — never surfaced to users. Override with AI_MODEL if needed.
const DEFAULT_MODEL = "claude-sonnet-5";

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;

  async complete(request: CompletionRequest): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: request.maxTokens ?? 4096,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    return data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
  }
}
