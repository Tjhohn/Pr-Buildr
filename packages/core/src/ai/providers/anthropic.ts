import type { AIProvider, DraftInput, DraftOutput } from "../types.js";
import type { AIConfig } from "../../config/schema.js";
import { buildPrompt } from "../prompt.js";
import { parseAIResponse } from "../parser.js";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly aiConfig?: AIConfig,
  ) {}

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const { system, user } = buildPrompt(input, this.aiConfig);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throwAnthropicError(response.status, errorBody);
    }

    const data = (await response.json()) as AnthropicResponse;
    const textBlock = data.content?.find((b) => b.type === "text");
    const content = textBlock?.text;

    if (!content) {
      throw new Error("Anthropic returned an empty response. Try again.");
    }

    return parseAIResponse(content);
  }
}

interface AnthropicResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
}

function throwAnthropicError(status: number, body: string): never {
  let message: string;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message ?? body;
  } catch {
    message = body;
  }

  switch (status) {
    case 401:
      throw new Error(`Anthropic authentication failed. Check your API key. Details: ${message}`);
    case 429:
      throw new Error(`Anthropic rate limit exceeded. Wait a moment and try again. Details: ${message}`);
    case 500:
    case 502:
    case 503:
      throw new Error(`Anthropic service error (${status}). Try again later. Details: ${message}`);
    default:
      throw new Error(`Anthropic API error (${status}): ${message}`);
  }
}
