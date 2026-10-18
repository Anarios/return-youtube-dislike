const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("@playwright/test");

async function runWatchWidthSmoke() {
  const repository = path.resolve(__dirname, "../../..");
  const output = path.join(repository, "test-results/discussion", `watch-width-${Date.now()}`);
  const css = await fs.readFile(path.join(repository, "Extensions/combined/content-style.css"), "utf8");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    for (const language of ["en", "ru"]) {
      const ru = language === "ru";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.setContent(
        `<!doctype html><html lang="${language}" dark><head><meta charset="utf-8"><style>
        body{margin:0;padding:24px;display:flex;justify-content:center;font:14px Arial,sans-serif;background:#0f0f0f;color:#f1f1f1}
        #native-parent{width:426.666px;min-width:426.666px;flex-shrink:0}
        #native-comments{height:52px} ${css}
      </style></head><body><main id="native-parent"><div id="native-comments">${ru ? "Комментарии отключены." : "Comments are turned off."}</div>
        <section id="ryd-discussion-panel" class="ryd-discussion">
          <header class="ryd-discussion-header"><div class="ryd-discussion-brand"><span class="ryd-discussion-logo">RYD</span><h2 class="ryd-discussion-title">${ru ? "Комментарии RYD" : "RYD comments"}</h2></div>
          <nav class="ryd-discussion-header-actions"><button class="ryd-discussion-button">${ru ? "Обсуждение" : "Discussion"}</button><button class="ryd-discussion-button">${ru ? "Уведомления" : "Notifications"}</button><button class="ryd-discussion-button">${ru ? "Модерация" : "Moderation"}</button></nav></header>
          <p class="ryd-discussion-description">${ru ? "Обсуждение сообщества Return YouTube Dislike." : "A community discussion hosted by Return YouTube Dislike."}</p>
          <p class="ryd-discussion-independent">${ru ? "Эти комментарии не связаны с комментариями YouTube." : "These comments are separate from YouTube."}</p>
          <textarea class="ryd-discussion-textarea">${ru ? "Проверка ширины комментариев" : "Discussion width check"}</textarea>
          <div class="ryd-discussion-form-actions"><button class="ryd-discussion-button ryd-discussion-primary">${ru ? "Отправить" : "Post"}</button></div>
        </section></main></body></html>`,
        { timeout: 5000 },
      );
      const panel = page.locator("#ryd-discussion-panel");
      const geometry = () =>
        page.evaluate(() => {
          const rect = document.querySelector("#ryd-discussion-panel").getBoundingClientRect();
          return {
            x: rect.x,
            width: rect.width,
            right: rect.right,
            viewport: innerWidth,
            nativeWidth: document.querySelector("#native-parent").getBoundingClientRect().width,
          };
        });
      const oldSizing = await page.addStyleTag({ content: "#ryd-discussion-panel{max-inline-size:none}" });
      await panel.scrollIntoViewIfNeeded();
      const before = await geometry();
      assert.ok(
        before.x < 0 || before.right > before.viewport,
        "The native wide parent must reproduce the original overflow",
      );
      await page.screenshot({ path: path.join(output, `${language}-before.png`), timeout: 5000 });
      await oldSizing.evaluate((node) => node.remove());
      await panel.scrollIntoViewIfNeeded();
      const after = await geometry();
      assert.equal(after.width, 342);
      assert.ok(after.x >= 0 && after.right <= after.viewport, "The narrow watch panel must fit inside the viewport");
      assert.equal(after.nativeWidth, before.nativeWidth, "Native container geometry must remain unchanged");
      await page.screenshot({ path: path.join(output, `${language}-after.png`), timeout: 5000 });
      await page.setViewportSize({ width: 1536, height: 639 });
      const desktop = await geometry();
      assert.equal(desktop.width, desktop.nativeWidth, "Desktop watch panel must still fill its parent");
      results.push({ language, before, after, desktop, passed: true });
    }
    await fs.writeFile(
      path.join(output, "result.json"),
      JSON.stringify({ kind: "hermetic-css-layout", results }, null, 2),
    );
    return { output, results };
  } finally {
    await browser.close();
  }
}

if (require.main === module)
  runWatchWidthSmoke()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });

module.exports = { runWatchWidthSmoke };
