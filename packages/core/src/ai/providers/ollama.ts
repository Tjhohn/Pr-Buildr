import type { AIProvider, DraftInput, DraftOutput } from "../types.js";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generateDraft(_input: DraftInput): Promise<DraftOutput> {
    // Stub — implementation in Phase 3
    throw new Error("Ollama provider not yet implemented");
  }
}
