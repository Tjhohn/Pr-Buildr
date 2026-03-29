import type { AIProvider, DraftInput, DraftOutput } from "../types.js";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateDraft(_input: DraftInput): Promise<DraftOutput> {
    // Stub — implementation in Phase 3
    throw new Error("Anthropic provider not yet implemented");
  }
}
