import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "./Badge";

const render = (el) => renderToStaticMarkup(el);
const classAttr = (html) => html.match(/class="([^"]*)"/)?.[1];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Badge", () => {
  it("keeps the known variant classes", () => {
    expect(classAttr(render(<Badge variant="green">Active</Badge>))).toBe("badge badge-green");
    expect(classAttr(render(<Badge>n/a</Badge>))).toBe("badge badge-gray");
  });

  it("maps the status aliases used across the pages", () => {
    const cases = {
      success: "badge-green",
      warning: "badge-yellow",
      danger: "badge-red",
      info: "badge-blue",
      neutral: "badge-gray",
    };
    for (const [variant, cls] of Object.entries(cases)) {
      expect(classAttr(render(<Badge variant={variant}>x</Badge>))).toBe(`badge ${cls}`);
    }
  });

  it("forwards style and extra props to the DOM", () => {
    const html = render(
      <Badge style={{ marginTop: 4 }} title="status">One-time</Badge>
    );
    expect(html).toContain("style=");
    expect(html).toContain("margin-top:4px");
    expect(html).toContain('title="status"');
  });

  it("falls back to gray and warns on an unknown variant", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(classAttr(render(<Badge variant="chartreuse">?</Badge>))).toBe("badge badge-gray");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("chartreuse"));
  });

  it("does not warn for aliases in sanctioned use", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Badge variant="success">Active</Badge>);
    expect(warn).not.toHaveBeenCalled();
  });
});
