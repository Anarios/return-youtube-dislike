const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "../content-style.css"), "utf8");

function getRuleDeclarations(selector, source = css) {
  const ruleStart = source.indexOf(`${selector} {`);
  if (ruleStart === -1) return {};
  const bodyStart = source.indexOf("{", ruleStart) + 1;
  const bodyEnd = source.indexOf("}", bodyStart);
  return Object.fromEntries(
    source
      .slice(bodyStart, bodyEnd)
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(":");
        return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()];
      }),
  );
}

describe("Shorts dislike production CSS contract", () => {
  it("uses readable light-theme colors and the native action-host height", () => {
    expect(getRuleDeclarations(".ryd-shorts-dislike")).toMatchObject({
      color: "#0f0f0f",
      "min-block-size": "78px",
      "row-gap": "6px",
    });
    expect(getRuleDeclarations(".ryd-shorts-dislike__button")).toMatchObject({
      "inline-size": "48px",
      "block-size": "48px",
      background: "rgba(0, 0, 0, 0.05)",
    });
  });

  it("provides an explicit dark-theme foreground and button surface", () => {
    expect(getRuleDeclarations("html[dark] .ryd-shorts-dislike")).toMatchObject({
      color: "#f1f1f1",
    });
    expect(getRuleDeclarations("html[dark] .ryd-shorts-dislike__button")).toMatchObject({
      background: "rgba(255, 255, 255, 0.1)",
    });
  });

  it("uses native-scale count typography within the 78px action host", () => {
    expect(getRuleDeclarations(".ryd-shorts-dislike__count")).toMatchObject({
      "font-size": "14px",
      "font-weight": "500",
      "line-height": "20px",
      "min-block-size": "20px",
    });
  });

  it("preserves focus, pressed, and reduced-motion affordances", () => {
    expect(getRuleDeclarations(".ryd-shorts-dislike__button:focus-visible")).toMatchObject({
      outline: "2px solid currentColor",
      "outline-offset": "2px",
    });
    expect(getRuleDeclarations('.ryd-shorts-dislike__button[aria-pressed="true"]')).toMatchObject({
      color: "#ff3b5c",
    });

    const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(getRuleDeclarations(".ryd-shorts-dislike__button", reducedMotion)).toMatchObject({
      transition: "none",
    });
  });

  it("uses distinct approved mask icons without changing icon geometry", () => {
    expect(css).toMatch(/\.ryd-shorts-dislike__icon\s*\{[^}]*inline-size:\s*24px;[^}]*block-size:\s*24px;/s);
    expect(css).toMatch(/background-color:\s*currentColor/);
    expect(css).toMatch(/data:image\/png;base64,/);
    expect(css).toMatch(/\.ryd-shorts-dislike__button\[aria-pressed="true"\]\s+\.ryd-shorts-dislike__icon/);

    const outlineMatch = css.match(
      /\.ryd-shorts-dislike__icon\s*\{[^}]*?(?:-webkit-)?mask-image:\s*url\("(data:image\/png;base64,[^"]+)"\)/s,
    );
    const filledMatch = css.match(
      /\.ryd-shorts-dislike__button\[aria-pressed="true"\]\s+\.ryd-shorts-dislike__icon\s*\{[^}]*?(?:-webkit-)?mask-image:\s*url\("(data:image\/png;base64,[^"]+)"\)/s,
    );

    expect(outlineMatch?.[1]).toBeTruthy();
    expect(filledMatch?.[1]).toBeTruthy();
    expect(filledMatch?.[1]).not.toBe(outlineMatch?.[1]);
  });
});
