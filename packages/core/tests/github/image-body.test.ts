import { describe, it, expect } from "vitest";
import { insertImagesIntoBody } from "../../src/github/image-body.js";
import type { ImageUploadResult } from "../../src/github/image-types.js";

const img1: ImageUploadResult = {
  id: "1",
  url: "https://github.com/user-attachments/assets/uuid-1",
  altText: "Login page",
  fileName: "login.png",
};

const img2: ImageUploadResult = {
  id: "2",
  url: "https://github.com/user-attachments/assets/uuid-2",
  altText: "Dashboard",
  fileName: "dashboard.gif",
};

const img3: ImageUploadResult = {
  id: "3",
  url: "https://github.com/user-attachments/assets/uuid-3",
  altText: "Error state",
  fileName: "error.png",
};

describe("insertImagesIntoBody", () => {
  it("returns body unchanged when no images", () => {
    const body = "## Summary\nSome changes.";
    expect(insertImagesIntoBody(body, [])).toBe(body);
  });

  it("replaces {image:N} by id", () => {
    const body = "## Summary\nHere is the login page:\n\n{image:1}\n\nLooks good.";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).not.toContain("{image:1}");
  });

  it("replaces {image:filename} by filename", () => {
    const body = "## Summary\nSee:\n\n{image:login.png}";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).not.toContain("{image:login.png}");
  });

  it("replaces {image:filename} case-insensitively", () => {
    const body = "See:\n\n{image:Login.PNG}";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
  });

  it("replaces multiple images by id", () => {
    const body = "Login:\n{image:1}\n\nDashboard:\n{image:2}";
    const result = insertImagesIntoBody(body, [img1, img2]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).toContain("![Dashboard](https://github.com/user-attachments/assets/uuid-2)");
    expect(result).not.toContain("{image:");
  });

  it("appends unreferenced images under new ## Screenshots section", () => {
    const body = "## Summary\nSome changes.";
    const result = insertImagesIntoBody(body, [img1, img2]);

    expect(result).toContain("## Screenshots");
    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).toContain("![Dashboard](https://github.com/user-attachments/assets/uuid-2)");
  });

  it("appends unreferenced images under existing ## Screenshots heading", () => {
    const body = "## Summary\nSome changes.\n\n## Screenshots\n\n_No screenshots yet._";
    const result = insertImagesIntoBody(body, [img1]);

    // Should not add a second ## Screenshots heading
    const screenshotCount = (result.match(/## Screenshots/g) || []).length;
    expect(screenshotCount).toBe(1);
    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
  });

  it("appends under existing ## Images heading", () => {
    const body = "## Summary\nChanges.\n\n## Images\n";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    // Should not add a separate ## Screenshots heading
    expect(result).not.toContain("## Screenshots");
  });

  it("handles mixed: some inline, some appended", () => {
    const body = "## Summary\n{image:1}\n\nMore text.";
    const result = insertImagesIntoBody(body, [img1, img2, img3]);

    // img1 should be inline
    expect(result).toContain("## Summary\n![Login page]");
    // img2 and img3 should be in Screenshots section
    expect(result).toContain("## Screenshots");
    expect(result).toContain("![Dashboard]");
    expect(result).toContain("![Error state]");
  });

  it("leaves unmatched placeholders as-is", () => {
    const body = "See: {image:99}";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("{image:99}");
    expect(result).toContain("## Screenshots");
    expect(result).toContain("![Login page]");
  });

  it("escapes brackets in alt text", () => {
    const imgWithBrackets: ImageUploadResult = {
      id: "1",
      url: "https://github.com/user-attachments/assets/uuid-x",
      altText: "Fix [bug] in parser",
      fileName: "fix.png",
    };
    const body = "{image:1}";
    const result = insertImagesIntoBody(body, [imgWithBrackets]);

    expect(result).toContain("![Fix \\[bug\\] in parser]");
  });

  it("handles empty body with images", () => {
    const result = insertImagesIntoBody("", [img1]);

    expect(result).toContain("## Screenshots");
    expect(result).toContain("![Login page]");
  });

  it("handles body with only whitespace", () => {
    const result = insertImagesIntoBody("  \n\n  ", [img1]);

    expect(result).toContain("## Screenshots");
    expect(result).toContain("![Login page]");
  });

  it("does not duplicate images referenced multiple times", () => {
    const body = "First: {image:1}\nSecond: {image:1}";
    const result = insertImagesIntoBody(body, [img1]);

    // Both placeholders should be replaced
    expect(result).not.toContain("{image:1}");
    // Image should appear twice (once per placeholder)
    const occurrences = (result.match(/!\[Login page\]/g) || []).length;
    expect(occurrences).toBe(2);
    // Should NOT also appear in a Screenshots section
    expect(result).not.toContain("## Screenshots");
  });

  // ── Markdown-wrapped placeholder tests ──

  it("replaces markdown-wrapped ![alt]({image:N}) by id", () => {
    const body = "## Visuals\n\n![screenshot]({image:1})\n\nLooks good.";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).not.toContain("{image:1}");
    expect(result).not.toContain("![screenshot]");
  });

  it("replaces markdown-wrapped ![alt]({image:filename}) by filename", () => {
    const body = "## Visuals\n\n![my screenshot]({image:login.png})";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).not.toContain("{image:login.png}");
    expect(result).not.toContain("![my screenshot]");
  });

  it("replaces multiple markdown-wrapped placeholders", () => {
    const body = "Login:\n![login screenshot]({image:1})\n\nDashboard:\n![dash]({image:2})";
    const result = insertImagesIntoBody(body, [img1, img2]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).toContain("![Dashboard](https://github.com/user-attachments/assets/uuid-2)");
    expect(result).not.toContain("{image:");
    expect(result).not.toContain("![login screenshot]");
    expect(result).not.toContain("![dash]");
  });

  it("handles mix of markdown-wrapped and bare placeholders", () => {
    const body = "Wrapped: ![pic]({image:1})\nBare: {image:2}";
    const result = insertImagesIntoBody(body, [img1, img2]);

    expect(result).toContain("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).toContain("![Dashboard](https://github.com/user-attachments/assets/uuid-2)");
    expect(result).not.toContain("{image:");
    expect(result).not.toContain("![pic]");
  });

  it("leaves unmatched markdown-wrapped placeholders as-is", () => {
    const body = "See: ![unknown]({image:99})";
    const result = insertImagesIntoBody(body, [img1]);

    expect(result).toContain("![unknown]({image:99})");
    expect(result).toContain("## Screenshots");
    expect(result).toContain("![Login page]");
  });

  it("does not produce nested markdown from wrapped placeholders", () => {
    const body = "![2026-04-23_15-43]({image:1})";
    const result = insertImagesIntoBody(body, [img1]);

    // Should produce clean markdown, not nested ![](![](url))
    expect(result).toBe("![Login page](https://github.com/user-attachments/assets/uuid-1)");
    expect(result).not.toContain("![2026-04-23_15-43]");
    // Verify no double ![ patterns (nested markdown)
    expect((result.match(/!\[/g) || []).length).toBe(1);
  });
});
