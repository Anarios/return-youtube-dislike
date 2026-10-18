const fs = require("node:fs");
const { OUTPUTS } = require("./generate-hide-clutter-tooltip-assets");

function readPngDimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) };
}

describe("hide-clutter tooltip assets", () => {
  test.each(Object.entries(OUTPUTS))("%s is a readable owned screenshot with useful dimensions", (name, filePath) => {
    expect(fs.existsSync(filePath)).toBe(true);
    const dimensions = readPngDimensions(filePath);
    expect(dimensions.width).toBeGreaterThanOrEqual(280);
    expect(dimensions.width).toBeLessThanOrEqual(320);
    expect(dimensions.height).toBeGreaterThanOrEqual(90);
    expect(dimensions.height).toBeLessThanOrEqual(150);
    expect(fs.statSync(filePath).size).toBeGreaterThan(3_000);
  });

  test("before and after are distinct images", () => {
    expect(fs.readFileSync(OUTPUTS.before).equals(fs.readFileSync(OUTPUTS.after))).toBe(false);
    expect(readPngDimensions(OUTPUTS.before).height).toBeGreaterThan(readPngDimensions(OUTPUTS.after).height);
  });
});
