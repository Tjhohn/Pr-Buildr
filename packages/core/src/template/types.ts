export interface TemplateResult {
  /** Where the template was found */
  source: "repo" | "builtin";
  /** The template content */
  content: string;
  /** File path if source is "repo" */
  path?: string;
}
