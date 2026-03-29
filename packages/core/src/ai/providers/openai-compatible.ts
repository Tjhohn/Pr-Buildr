import type { AIProvider, DraftInput, DraftOutput } from "../types.js";

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly apiKey?: string,
  ) {}

  async generateDraft(_input: DraftInput): Promise<DraftOutput> {
    // Stub — implementation in Phase 3
    throw new Error("OpenAI-compatible provider not yet implemented");
  }
}
