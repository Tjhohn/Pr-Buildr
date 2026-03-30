import type { PrBuildrConfig } from "./schema.js";

export const defaultConfig: PrBuildrConfig = {
  defaultBase: "main",
  github: {
    draftByDefault: false,
  },
  ai: {
    provider: "openai",
    model: "gpt-4o",
    diffBudget: 12000,
    categoryWeights: {
      primary: 60,
      test: 25,
      config: 10,
      other: 5,
    },
  },
  providers: {
    openai: { apiKeyEnv: "OPENAI_API_KEY" },
    anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" },
    ollama: {
      baseUrl: "http://127.0.0.1:11434",
      model: "llama3.1",
    },
    openaiCompatible: {
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKeyEnv: "LOCAL_AI_API_KEY",
      model: "local-model",
    },
  },
  branchBases: {},
  jira: {},
};
