import { describe, it, expect } from "vitest";
import {
  inferTicketFromBranch,
  buildJiraUrl,
  formatTitleWithTicket,
  ensureJiraLinkInBody,
} from "../../src/jira/parser.js";

describe("inferTicketFromBranch", () => {
  it("extracts ticket from start of branch name", () => {
    expect(inferTicketFromBranch("AA-1234-fix-login", "AA")).toBe("AA-1234");
  });

  it("extracts ticket after prefix directory", () => {
    expect(inferTicketFromBranch("feature/AA-7668-broken-auth", "AA")).toBe("AA-7668");
  });

  it("extracts ticket with different project key", () => {
    expect(inferTicketFromBranch("bugfix/PM-567-thing", "PM")).toBe("PM-567");
  });

  it("handles long project keys", () => {
    expect(inferTicketFromBranch("DATATEAM-55-migration", "DATATEAM")).toBe("DATATEAM-55");
  });

  it("extracts bare ticket", () => {
    expect(inferTicketFromBranch("AA-1234", "AA")).toBe("AA-1234");
  });

  it("returns undefined when no match", () => {
    expect(inferTicketFromBranch("fix-login", "AA")).toBeUndefined();
  });

  it("returns undefined for wrong project key", () => {
    expect(inferTicketFromBranch("PRD-55-deploy", "AA")).toBeUndefined();
  });

  it("returns first match when multiple tickets in branch", () => {
    expect(inferTicketFromBranch("AA-1234-AA-5678-combined", "AA")).toBe("AA-1234");
  });

  it("is case-sensitive for project key", () => {
    expect(inferTicketFromBranch("aa-1234-lowercase", "AA")).toBeUndefined();
  });

  it("handles ticket in middle of branch name", () => {
    expect(inferTicketFromBranch("feature/fix-AA-999-urgent", "AA")).toBe("AA-999");
  });
});

describe("buildJiraUrl", () => {
  it("builds correct browse URL", () => {
    expect(buildJiraUrl("https://company.atlassian.net", "AA-1234")).toBe(
      "https://company.atlassian.net/browse/AA-1234",
    );
  });

  it("strips trailing slash", () => {
    expect(buildJiraUrl("https://company.atlassian.net/", "AA-1234")).toBe(
      "https://company.atlassian.net/browse/AA-1234",
    );
  });

  it("strips /browse suffix", () => {
    expect(buildJiraUrl("https://company.atlassian.net/browse", "AA-1234")).toBe(
      "https://company.atlassian.net/browse/AA-1234",
    );
  });

  it("strips /browse/ suffix with trailing slash", () => {
    expect(buildJiraUrl("https://company.atlassian.net/browse/", "AA-1234")).toBe(
      "https://company.atlassian.net/browse/AA-1234",
    );
  });

  it("handles multiple trailing slashes", () => {
    expect(buildJiraUrl("https://company.atlassian.net///", "PM-55")).toBe(
      "https://company.atlassian.net/browse/PM-55",
    );
  });
});

describe("formatTitleWithTicket", () => {
  it("prepends ticket ID to title", () => {
    expect(formatTitleWithTicket("Add login fix", "AA-1234")).toBe(
      "AA-1234: Add login fix",
    );
  });

  it("does not duplicate if title already has ticket prefix", () => {
    expect(formatTitleWithTicket("AA-1234: Add login fix", "AA-1234")).toBe(
      "AA-1234: Add login fix",
    );
  });

  it("does not duplicate with no space after colon", () => {
    expect(formatTitleWithTicket("AA-1234:Add login fix", "AA-1234")).toBe(
      "AA-1234:Add login fix",
    );
  });

  it("prepends even if a different ticket is in title", () => {
    expect(formatTitleWithTicket("BB-999: Old title", "AA-1234")).toBe(
      "AA-1234: BB-999: Old title",
    );
  });
});

describe("ensureJiraLinkInBody", () => {
  it("returns body unchanged if URL already present", () => {
    const body = "## Summary\nFixes the bug.\n\n**Jira:** https://co.atlassian.net/browse/AA-1234";
    const url = "https://co.atlassian.net/browse/AA-1234";
    expect(ensureJiraLinkInBody(body, url)).toBe(body);
  });

  it("appends URL at bottom if not present", () => {
    const body = "## Summary\nFixes the bug.";
    const url = "https://co.atlassian.net/browse/AA-1234";
    const result = ensureJiraLinkInBody(body, url);
    expect(result).toContain(body);
    expect(result).toContain("**Jira:** https://co.atlassian.net/browse/AA-1234");
    expect(result.indexOf("**Jira:**")).toBeGreaterThan(body.length);
  });

  it("handles empty body", () => {
    const result = ensureJiraLinkInBody("", "https://co.atlassian.net/browse/AA-1234");
    expect(result).toContain("**Jira:** https://co.atlassian.net/browse/AA-1234");
  });

  it("detects URL anywhere in body (not just at bottom)", () => {
    const body = "Fixes https://co.atlassian.net/browse/AA-1234 — see ticket for details.\n\n## Changes";
    const url = "https://co.atlassian.net/browse/AA-1234";
    expect(ensureJiraLinkInBody(body, url)).toBe(body);
  });
});
