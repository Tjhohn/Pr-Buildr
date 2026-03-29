import type { PrBuildrConfig } from "../config/schema.js";
import type { AIProvider } from "./types.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OllamaProvider } from "./providers/ollama.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";

/**
 * Create an AI provider instance based on the current config.
 * Resolves API keys from environment variables as specified in the config.
 */
export function createAIProvider(config: PrBuildrConfig): AIProvider {
  const providerName = config.ai?.provider ?? "openai";
  const model = config.ai?.model ?? getDefaultModel(providerName);

  switch (providerName) {
    case "openai": {
      const apiKey = resolveApiKey(
        config.providers?.openai?.apiKeyEnv ?? "OPENAI_API_KEY",
        "OpenAI",
      );
      return new OpenAIProvider(apiKey, model, config.ai);
    }

    case "anthropic": {
      const apiKey = resolveApiKey(
        config.providers?.anthropic?.apiKeyEnv ?? "ANTHROPIC_API_KEY",
        "Anthropic",
      );
      return new AnthropicProvider(apiKey, model, config.ai);
    }

    case "ollama": {
      const baseUrl = config.providers?.ollama?.baseUrl ?? "http://127.0.0.1:11434";
      const ollamaModel = config.providers?.ollama?.model ?? model;
      return new OllamaProvider(baseUrl, ollamaModel, config.ai);
    }

    case "openai-compatible": {
      const baseUrl = config.providers?.openaiCompatible?.baseUrl;
      if (!baseUrl) {
        throw new Error(
          "OpenAI-compatible provider requires a baseUrl. " +
            'Set providers.openaiCompatible.baseUrl in .pr-builder.json.',
        );
      }
      const compatModel = config.providers?.openaiCompatible?.model ?? model;
      const apiKeyEnv = config.providers?.openaiCompatible?.apiKeyEnv;
      const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined;
      return new OpenAICompatibleProvider(baseUrl, compatModel, config.ai, apiKey);
    }

    default:
      throw new Error(
        `Unknown AI provider "${providerName}". ` +
          `Valid providers: openai, anthropic, ollama, openai-compatible`,
      );
  }
}

function resolveApiKey(envVarName: string, providerDisplayName: string): string {
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(
      `${providerDisplayName} API key not found. ` +
        `Set the ${envVarName} environment variable, ` +
        `or configure a different key name in .pr-builder.json under providers.`,
    );
  }
  return value;
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "ollama":
      return "llama3.1";
    default:
      return "gpt-4o";
  }
}
