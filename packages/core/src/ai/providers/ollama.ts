import type { AIProvider, DraftInput, DraftOutput } from "../types.js";
import type { AIConfig } from "../../config/schema.js";
import { buildPrompt } from "../prompt.js";
import { parseAIResponse } from "../parser.js";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly aiConfig?: AIConfig,
  ) {}

  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const { system, user } = buildPrompt(input, this.aiConfig);
    const url = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          stream: false,
          format: "json",
        }),
      });
    } catch (err: unknown) {
      if (isConnectionError(err)) {
        throw new Error(
          `Could not connect to Ollama at ${url}. ` +
            `Make sure Ollama is running (ollama serve) and accessible at ${this.baseUrl}.`,
        );
      }
      throw err;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OllamaResponse;
    const content = data.message?.content;

    if (!content) {
      throw new Error("Ollama returned an empty response. Try again or use a different model.");
    }

    return parseAIResponse(content);
  }
}

interface OllamaResponse {
  message?: {
    content?: string;
  };
}

function isConnectionError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("econnrefused") || msg.includes("network") || msg.includes("connect");
  }
  return false;
}
