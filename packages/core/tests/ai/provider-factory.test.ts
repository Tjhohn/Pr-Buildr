import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAIProvider } from "../../src/ai/provider-factory.js";
import type { PrBuildrConfig } from "../../src/config/schema.js";

beforeEach(() => {
  // Set API keys so providers can be created
  process.env["OPENAI_API_KEY"] = "test-openai-key";
  process.env["ANTHROPIC_API_KEY"] = "test-anthropic-key";
});

afterEach(() => {
  delete process.env["OPENAI_API_KEY"];
  delete process.env["ANTHROPIC_API_KEY"];
  delete process.env["LOCAL_AI_API_KEY"];
  vi.restoreAllMocks();
});

describe("createAIProvider", () => {
  it("creates OpenAI provider by default", () => {
    const config: PrBuildrConfig = {};
    const provider = createAIProvider(config);
    expect(provider.name).toBe("openai");
  });

  it("creates OpenAI provider when specified", () => {
    const config: PrBuildrConfig = { ai: { provider: "openai" } };
    const provider = createAIProvider(config);
    expect(provider.name).toBe("openai");
  });

  it("creates Anthropic provider", () => {
    const config: PrBuildrConfig = { ai: { provider: "anthropic" } };
    const provider = createAIProvider(config);
    expect(provider.name).toBe("anthropic");
  });

  it("creates Ollama provider", () => {
    const config: PrBuildrConfig = { ai: { provider: "ollama" } };
    const provider = createAIProvider(config);
    expect(provider.name).toBe("ollama");
  });

  it("creates OpenAI-compatible provider", () => {
    const config: PrBuildrConfig = {
      ai: { provider: "openai-compatible" },
      providers: {
        openaiCompatible: {
          baseUrl: "http://localhost:1234/v1",
          model: "local-model",
        },
      },
    };
    const provider = createAIProvider(config);
    expect(provider.name).toBe("openai-compatible");
  });

  it("throws on missing OpenAI API key", () => {
    delete process.env["OPENAI_API_KEY"];
    const config: PrBuildrConfig = { ai: { provider: "openai" } };
    expect(() => createAIProvider(config)).toThrow("OPENAI_API_KEY");
  });

  it("throws on missing Anthropic API key", () => {
    delete process.env["ANTHROPIC_API_KEY"];
    const config: PrBuildrConfig = { ai: { provider: "anthropic" } };
    expect(() => createAIProvider(config)).toThrow("ANTHROPIC_API_KEY");
  });

  it("throws on missing baseUrl for openai-compatible", () => {
    const config: PrBuildrConfig = { ai: { provider: "openai-compatible" } };
    expect(() => createAIProvider(config)).toThrow("baseUrl");
  });

  it("throws on unknown provider", () => {
    const config: PrBuildrConfig = { ai: { provider: "unknown" } };
    expect(() => createAIProvider(config)).toThrow("Unknown AI provider");
  });

  it("uses custom API key env var name", () => {
    delete process.env["OPENAI_API_KEY"];
    process.env["MY_CUSTOM_KEY"] = "custom-key";
    const config: PrBuildrConfig = {
      ai: { provider: "openai" },
      providers: { openai: { apiKeyEnv: "MY_CUSTOM_KEY" } },
    };
    const provider = createAIProvider(config);
    expect(provider.name).toBe("openai");
    delete process.env["MY_CUSTOM_KEY"];
  });

  it("ollama does not require API key", () => {
    delete process.env["OPENAI_API_KEY"];
    const config: PrBuildrConfig = { ai: { provider: "ollama" } };
    // Should not throw
    const provider = createAIProvider(config);
    expect(provider.name).toBe("ollama");
  });
});
