const fs = require("fs");
const path = require("path");

describe("generated userscript file", () => {
  const filePath = path.join(__dirname, "Return Youtube Dislike.user.js");
  let content;

  beforeAll(() => {
    content = fs.readFileSync(filePath, "utf8");
  });

  it("has a well-formed UserScript metadata block", () => {
    const match = content.match(/^\/\/ ==UserScript==\n([\s\S]*?)\n\/\/ ==\/UserScript==\n/);
    expect(match).not.toBeNull();

    const block = match[1];
    for (const tag of ["@name", "@namespace", "@version", "@match", "@grant", "@downloadURL", "@updateURL"]) {
      const tagMatch = block.match(new RegExp(`^// ${tag}\\s+(\\S.*)$`, "m"));
      expect(tagMatch).not.toBeNull();
      expect(tagMatch[1].trim().length).toBeGreaterThan(0);
    }
  });

  it("parses as syntactically valid JavaScript after stripping the metadata block", () => {
    const body = content.replace(/^\/\/ ==UserScript==\n[\s\S]*?\n\/\/ ==\/UserScript==\n/, "");

    // new Function only compiles the source, it never executes it, so this is
    // safe even though the script body runs top-level DOM/fetch calls.
    expect(() => new Function(body)).not.toThrow();
  });
});
