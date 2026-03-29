export interface TemplateResult {
  /** Where the template was found */
  source: "repo" | "builtin" | "custom";
  /** The template content */
  content: string;
  /** File path if source is "repo" or "custom" */
  path?: string;
}
