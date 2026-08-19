import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";

const render = (el) => renderToStaticMarkup(el);
const classAttr = (html) => html.match(/class="([^"]*)"/)?.[1];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Button", () => {
  it("keeps the known variant classes", () => {
    expect(classAttr(render(<Button variant="danger">Delete</Button>))).toBe("btn btn-danger");
    expect(classAttr(render(<Button variant="primary">Save</Button>))).toBe("btn btn-primary");
    expect(classAttr(render(<Button size="sm">View</Button>))).toBe("btn btn-sm");
  });

  it("forwards style and title to the DOM", () => {
    const html = render(
      <Button style={{ width: "100%" }} title="Block this account">Block</Button>
    );
    expect(html).toContain('style="width:100%"');
    expect(html).toContain('title="Block this account"');
  });

  it("renders the secondary and outline aliases as the base button, never class undefined", () => {
    for (const variant of ["secondary", "outline"]) {
      const html = render(<Button variant={variant}>Cancel</Button>);
      expect(classAttr(html)).toBe("btn");
      expect(html).not.toContain("undefined");
    }
  });

  it("falls back to the base button and warns on an unknown variant", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = render(<Button variant="chartreuse">?</Button>);
    expect(classAttr(html)).toBe("btn");
    expect(html).not.toContain("undefined");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("chartreuse"));
  });

  it("does not warn for aliases in sanctioned use", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Button variant="secondary">Cancel</Button>);
    expect(warn).not.toHaveBeenCalled();
  });

  it("still applies type, disabled, and extra props", () => {
    const html = render(
      <Button type="submit" disabled aria-label="save">Save</Button>
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="save"');
  });
});
