import * as vscode from "vscode";
import { storeAIApiKey } from "../auth.js";

/**
 * Command: PR Builder: Set OpenAI API Key
 * Prompts for the key via masked input box and stores in SecretStorage.
 */
export async function setOpenAIKeyCommand(
  secrets: vscode.SecretStorage,
): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your OpenAI API key",
    password: true,
    placeHolder: "sk-...",
    ignoreFocusOut: true,
  });

  if (!key) return;

  await storeAIApiKey(secrets, "openai", key);
  vscode.window.showInformationMessage("OpenAI API key saved securely.");
}

/**
 * Command: PR Builder: Set Anthropic API Key
 */
export async function setAnthropicKeyCommand(
  secrets: vscode.SecretStorage,
): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your Anthropic API key",
    password: true,
    placeHolder: "sk-ant-...",
    ignoreFocusOut: true,
  });

  if (!key) return;

  await storeAIApiKey(secrets, "anthropic", key);
  vscode.window.showInformationMessage("Anthropic API key saved securely.");
}

/**
 * Command: PR Builder: Set OpenAI-Compatible API Key
 */
export async function setOpenAICompatibleKeyCommand(
  secrets: vscode.SecretStorage,
): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Enter your OpenAI-compatible server API key",
    password: true,
    placeHolder: "API key (leave empty if not required)",
    ignoreFocusOut: true,
  });

  if (key === undefined) return; // cancelled
  if (key === "") {
    vscode.window.showInformationMessage(
      "No API key set. The server will be accessed without authentication.",
    );
    return;
  }

  await storeAIApiKey(secrets, "openai-compatible", key);
  vscode.window.showInformationMessage("OpenAI-compatible API key saved securely.");
}
