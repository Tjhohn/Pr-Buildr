import type { AIProvider, DraftInput, DraftOutput } from "../types.js";
import type { AIConfig } from "../../config/schema.js";
import { buildPrompt } from "../prompt.js";
import { parseAIResponse } from "../parser.js";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly aiConfig?: AIConfig,
  ) {}

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const { system, user } = buildPrompt(input, this.aiConfig);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throwProviderError("OpenAI", response.status, errorBody);
    }

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned an empty response. Try again.");
    }

    return parseAIResponse(content);
  }
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function throwProviderError(provider: string, status: number, body: string): never {
  let message: string;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message ?? body;
  } catch {
    message = body;
  }

  switch (status) {
    case 401:
      throw new Error(`${provider} authentication failed. Check your API key. Details: ${message}`);
    case 429:
      throw new Error(`${provider} rate limit exceeded. Wait a moment and try again. Details: ${message}`);
    case 500:
    case 502:
    case 503:
      throw new Error(`${provider} service error (${status}). Try again later. Details: ${message}`);
    default:
      throw new Error(`${provider} API error (${status}): ${message}`);
  }
}
