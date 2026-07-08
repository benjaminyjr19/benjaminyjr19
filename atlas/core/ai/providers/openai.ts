import type { AIProvider, CompletionRequest } from "../provider";

const API_URL = "https://api.openai.com/v1/chat/completions";
// Internal default — never surfaced to users. Override with AI_MODEL if needed.
const DEFAULT_MODEL = "gpt-4o-mini";

interface OpenAIResponse {
  choices: Array<{ message: { content: string | null } }>;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;

  async complete(request: CompletionRequest): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: request.maxTokens ?? 4096,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    return data.choices[0]?.message.content ?? "";
  }
}
