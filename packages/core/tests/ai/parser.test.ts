import { describe, it, expect } from "vitest";
import { parseAIResponse } from "../../src/ai/parser.js";

describe("parseAIResponse", () => {
  describe("JSON parsing (primary path)", () => {
    it("parses valid JSON response", () => {
      const raw = JSON.stringify({
        title: "Add user authentication",
        body: "## Summary\nAdds JWT auth.\n\n## Changes\n- New middleware",
      });

      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add user authentication");
      expect(result.body).toContain("## Summary");
    });

    it("strips code fences wrapping JSON", () => {
      const raw = '```json\n{"title": "Fix bug", "body": "## Summary\\nFixed it."}\n```';
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Fix bug");
      expect(result.body).toContain("Fixed it.");
    });

    it("strips code fences without json tag", () => {
      const raw = '```\n{"title": "Fix bug", "body": "Body here"}\n```';
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Fix bug");
    });

    it("trims whitespace from title and body", () => {
      const raw = JSON.stringify({
        title: "  Add feature  ",
        body: "  Body content  ",
      });
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add feature");
      expect(result.body).toBe("Body content");
    });
  });

  describe("fallback parsing (line-based)", () => {
    it("extracts title from first line, body after blank line", () => {
      const raw = "Add user authentication\n\n## Summary\nThis PR adds auth.";
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add user authentication");
      expect(result.body).toContain("## Summary");
    });

    it("strips markdown heading prefix from title", () => {
      const raw = "# Add user authentication\n\nBody here.";
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add user authentication");
    });

    it("strips ## prefix from title", () => {
      const raw = "## Add user authentication\n\nBody here.";
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add user authentication");
    });

    it("strips surrounding quotes from title", () => {
      const raw = '"Add user authentication"\n\nBody here.';
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add user authentication");
    });

    it("handles empty body", () => {
      const raw = "Add user authentication";
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add user authentication");
      expect(result.body).toBe("");
    });

    it("skips leading blank lines to find title", () => {
      const raw = "\n\n  Add feature  \n\nBody here.";
      const result = parseAIResponse(raw);
      expect(result.title).toBe("Add feature");
    });
  });

  describe("error cases", () => {
    it("throws on empty response", () => {
      expect(() => parseAIResponse("")).toThrow("empty response");
    });

    it("throws on whitespace-only response", () => {
      expect(() => parseAIResponse("   \n  \n  ")).toThrow("empty response");
    });
  });
});
