import type { AIProvider, DraftInput, DraftOutput } from "../types.js";
import type { AIConfig } from "../../config/schema.js";
import { buildPrompt } from "../prompt.js";
import { parseAIResponse } from "../parser.js";

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly aiConfig?: AIConfig,
    private readonly apiKey?: string,
  ) {}

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const { system, user } = buildPrompt(input, this.aiConfig);
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
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
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes("ECONNREFUSED") || err.message.includes("fetch"))) {
        throw new Error(
          `Could not connect to OpenAI-compatible server at ${this.baseUrl}. ` +
            `Make sure the server is running and accessible.`,
        );
      }
      throw err;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI-compatible API error (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as OpenAICompatibleResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI-compatible server returned an empty response. Try again.");
    }

    return parseAIResponse(content);
  }
}

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
