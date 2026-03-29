import type { AIProvider, DraftInput, DraftOutput } from "../types.js";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateDraft(_input: DraftInput): Promise<DraftOutput> {
    // Stub — implementation in Phase 3
    throw new Error("OpenAI provider not yet implemented");
  }
}
