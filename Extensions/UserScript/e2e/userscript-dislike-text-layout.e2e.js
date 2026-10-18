const { test, expect } = require("@playwright/test");
const {
  CREDENTIAL_KEY,
  VIDEO_A,
  VIDEO_B,
  createFakeBackend,
  injectGeneratedUserscript,
  installGmEnvironment,
  installHermeticRoutes,
  openWatchFixture,
} = require("./harness");

// This fixture uses the native shape classes to model icon-only and text-button spacing.
function installNativeWatchTextLayout({ shape = "current", direction = "ltr" } = {}) {
  document.documentElement.dir = direction;
  const current = shape === "current";
  const shapeClasses = {
    host: current ? "ytSpecButtonShapeNextHost" : "yt-spec-button-shape-next",
    iconOnly: current ? "ytSpecButtonShapeNextIconButton" : "yt-spec-button-shape-next--icon-button",
    iconLeading: current ? "ytSpecButtonShapeNextIconLeading" : "yt-spec-button-shape-next--icon-leading",
    icon: current ? "ytSpecButtonShapeNextIcon" : "yt-spec-button-shape-next__icon",
    text: current ? "ytSpecButtonShapeNextButtonTextContent" : "yt-spec-button-shape-next__button-text-content",
  };

  if (!document.getElementById("fixture-native-watch-text-style")) {
    const style = document.createElement("style");
    style.id = "fixture-native-watch-text-style";
    style.textContent = `
      #fixture-watch #top-level-buttons-computed,
      #fixture-watch [data-fixture-smartimation-content] { width: max-content; }
      #fixture-watch [data-ryd-role="like"],
      #fixture-watch [data-ryd-role="dislike"] { width: auto; flex: 0 0 auto; }
      #fixture-watch [data-ryd-role] button {
        display: inline-flex; position: relative; align-items: center; justify-content: center;
        gap: 0; width: auto; min-width: 0; padding: 0 16px; height: 36px;
      }
      #fixture-watch [data-ryd-role] button:is(.ytSpecButtonShapeNextIconButton, .yt-spec-button-shape-next--icon-button) {
        width: 40px; padding: 0;
      }
      #fixture-watch [data-ryd-role] :is(.ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon) {
        display: flex; flex: 0 0 20px; width: 20px; height: 20px; margin: 0;
      }
      #fixture-watch [data-ryd-role] button:is(.ytSpecButtonShapeNextIconLeading, .yt-spec-button-shape-next--icon-leading)
        > :is(.ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon) {
        margin-inline-start: -6px; margin-inline-end: 6px;
      }
      #fixture-watch [data-ryd-role] :is(.ytSpecButtonShapeNextButtonTextContent, .yt-spec-button-shape-next__button-text-content) {
        display: block; line-height: 20px; white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  for (const role of ["like", "dislike"]) {
    const host = document.querySelector(`#fixture-watch [data-ryd-role="${role}"]`);
    const button = host.querySelector("button");
    const svg = button.querySelector("svg");
    let icon = svg.parentElement;
    if (icon === button) {
      icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      svg.replaceWith(icon);
      icon.appendChild(svg);
    }
    icon.className = shapeClasses.icon;
    button.className = `${shapeClasses.host} ${role === "like" ? shapeClasses.iconLeading : shapeClasses.iconOnly}`;
    if (role === "like") {
      const text = button.querySelector(".ytSpecButtonShapeNextButtonTextContent, #text");
      text.textContent = text.textContent.trim();
      text.className = shapeClasses.text;
      text.id = "text";
      text.setAttribute("role", "text");
    } else {
      for (const text of button.querySelectorAll("#text")) text.remove();
    }
  }
  globalThis.__nativeWatchShape = shapeClasses;
}

async function expectNativeCountLayout(page) {
  const layout = await page.evaluate(() => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width };
    };
    const direction = document.documentElement.dir;
    return ["like", "dislike"].map((role) => {
      const host = document.querySelector(`#fixture-watch [data-ryd-role="${role}"]`);
      const button = host.querySelector("button");
      const icon = rect(button.querySelector("svg"));
      const text = button.querySelector("#text");
      const count = rect(text);
      const bounds = rect(button);
      return {
        button: bounds,
        icon,
        count,
        gap: direction === "rtl" ? icon.left - count.right : count.left - icon.right,
        startPadding: direction === "rtl" ? bounds.right - icon.right : icon.left - bounds.left,
        endPadding: direction === "rtl" ? count.left - bounds.left : bounds.right - count.right,
        textFont: getComputedStyle(text).font,
        textTag: text.tagName,
        nativeTextClass: text.classList.contains(globalThis.__nativeWatchShape.text),
        countContainers: host.querySelectorAll("#text").length,
      };
    });
  });
  const [like, dislike] = layout;
  expect(dislike.textTag).toBe("DIV");
  expect(dislike.nativeTextClass).toBe(true);
  expect(dislike.countContainers).toBe(1);
  expect(dislike.count.width).toBeGreaterThan(0);
  expect(dislike.gap).toBeGreaterThan(0);
  expect(dislike.gap).toBeCloseTo(like.gap, 1);
  expect(dislike.startPadding).toBeCloseTo(like.startPadding, 1);
  expect(dislike.endPadding).toBeCloseTo(like.endPadding, 1);
  expect(dislike.textFont).toBe(like.textFont);
  expect(dislike.count.left).toBeGreaterThanOrEqual(dislike.button.left);
  expect(dislike.count.right).toBeLessThanOrEqual(dislike.button.right);
  expect(Math.abs(dislike.icon.top + dislike.icon.bottom - dislike.count.top - dislike.count.bottom)).toBeLessThan(1);
}

for (const shape of ["current", "older"]) {
  for (const direction of ["ltr", "rtl"]) {
    test(`${shape} watch fallback matches native text layout in ${direction} across updates and navigation`, async ({
      context,
      page,
    }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const backend = createFakeBackend({
        countsByVideo: { [VIDEO_A]: { likes: 100, dislikes: 25 }, [VIDEO_B]: { likes: 200, dislikes: 37 } },
        fixture: { nativeDislikeText: false },
      });
      await installGmEnvironment(context, {
        [CREDENTIAL_KEY]: { registrationConfirmed: true, userId: "ExistingUserscriptCredential00000001" },
      });
      await installHermeticRoutes(context, backend);
      await openWatchFixture(page, VIDEO_A);
      await page.evaluate(installNativeWatchTextLayout, { shape, direction });
      await page.evaluate(() => {
        const host = document.querySelector('#fixture-watch [data-ryd-role="dislike"]');
        globalThis.__nativeWatchOriginal = {
          button: host.querySelector("button"),
          icon: host.querySelector("svg"),
          feedback: host.querySelector("[data-fixture-touch-feedback]"),
        };
      });
      await injectGeneratedUserscript(page);

      const dislike = page.locator('#fixture-watch [data-ryd-role="dislike"]');
      await expect(dislike.locator("#text")).toHaveText("25");
      await expectNativeCountLayout(page);
      expect(
        await page.evaluate(() => {
          const host = document.querySelector('#fixture-watch [data-ryd-role="dislike"]');
          const original = globalThis.__nativeWatchOriginal;
          globalThis.__nativeWatchFirstCount = host.querySelector("#text");
          return (
            host.querySelector("button") === original.button &&
            host.querySelector("svg") === original.icon &&
            host.querySelector("[data-fixture-touch-feedback]") === original.feedback
          );
        }),
      ).toBe(true);
      await expect(dislike.locator("button")).toHaveAttribute("aria-label", "Dislike this video");
      await expect(dislike.locator("button")).toHaveAttribute("aria-pressed", "false");

      await dislike.locator("#text").click();
      await expect(dislike.locator("#text")).toHaveText("26");
      await expect.poll(() => backend.requestsFor("POST", "/interact/confirmVote").length).toBe(1);
      await expectNativeCountLayout(page);
      expect(
        await page.evaluate(
          () =>
            document.querySelector('#fixture-watch [data-ryd-role="dislike"] #text') ===
            globalThis.__nativeWatchFirstCount,
        ),
      ).toBe(true);

      await page.evaluate(() => {
        const host = document.querySelector('#fixture-watch [data-ryd-role="dislike"]');
        const replacement = host.cloneNode(true);
        replacement.querySelector("#text").remove();
        const button = replacement.querySelector("button");
        button.className = `${globalThis.__nativeWatchShape.host} ${globalThis.__nativeWatchShape.iconOnly}`;
        host.replaceWith(replacement);
      });
      await expect(dislike.locator("#text")).toHaveText("26");
      await expectNativeCountLayout(page);
      expect(backend.requestsFor("GET", "/votes")).toHaveLength(1);

      await page.evaluate(({ videoId }) => globalThis.__youtubeFixture.navigate(videoId), { videoId: VIDEO_B });
      await page.evaluate(installNativeWatchTextLayout, { shape, direction });
      await expect(dislike.locator("#text")).toHaveText("37");
      await expectNativeCountLayout(page);
      await expect(dislike.locator("button")).toHaveAttribute("aria-pressed", "false");
      expect(backend.requestsFor("GET", "/votes").map(({ query }) => query.videoId)).toEqual([VIDEO_A, VIDEO_B]);
      expect(
        backend.requestsFor("POST", "/interact/vote").map(({ body }) => ({ videoId: body.videoId, value: body.value })),
      ).toEqual([{ videoId: VIDEO_A, value: -1 }]);
      expect(backend.blockedRequests).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test(`${shape} class-only native count clears during navigation and reuses its node for the next video`, async ({
    context,
    page,
  }) => {
    const backend = createFakeBackend({
      countsByVideo: { [VIDEO_A]: { likes: 100, dislikes: 25 }, [VIDEO_B]: { likes: 200, dislikes: 37 } },
      fixture: { nativeDislikeText: false },
    });
    await installGmEnvironment(context, {
      [CREDENTIAL_KEY]: { registrationConfirmed: true, userId: "ExistingUserscriptCredential00000001" },
    });
    await installHermeticRoutes(context, backend);
    await openWatchFixture(page, VIDEO_A);
    await page.evaluate(installNativeWatchTextLayout, { shape });
    await page.evaluate(() => {
      const button = document.querySelector('#fixture-watch [data-ryd-role="dislike"] button');
      const count = document.createElement("div");
      count.className = globalThis.__nativeWatchShape.text;
      count.setAttribute("data-fixture-native-count", "true");
      button.className = `${globalThis.__nativeWatchShape.host} ${globalThis.__nativeWatchShape.iconLeading}`;
      button.appendChild(count);
      globalThis.__nativeWatchExistingCount = count;
    });
    await injectGeneratedUserscript(page);
    const count = page.locator("[data-fixture-native-count]");
    await expect(count).toHaveText("25");
    await expect(count).not.toHaveAttribute("id");
    await expect(count).not.toHaveAttribute("role");

    const nextCounts = backend.defer("GET", "/votes");
    await page.evaluate((videoId) => {
      document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
      history.pushState({}, "", `/watch?v=${videoId}`);
      document.querySelector("#fixture-watch").setAttribute("video-id", videoId);
      for (const role of ["like", "dislike"]) {
        const button = document.querySelector(`#fixture-watch [data-ryd-role="${role}"] button`);
        button.setAttribute("data-video-id", videoId);
        button.setAttribute("aria-label", role === "like" ? "200 likes" : "Dislike the next video");
      }
      document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
    }, VIDEO_B);
    await nextCounts.seen;
    await expect(count).toHaveText("");
    nextCounts.release({ body: { likes: 200, dislikes: 37 } });
    await expect(count).toHaveText("37");
    expect(
      await page.evaluate(
        () => document.querySelector("[data-fixture-native-count]") === globalThis.__nativeWatchExistingCount,
      ),
    ).toBe(true);
    await expect(count).not.toHaveAttribute("id");
    await expect(count).not.toHaveAttribute("role");
    await expect(page.locator('#fixture-watch [data-ryd-role="dislike"] #text')).toHaveCount(0);
    expect(backend.requestsFor("POST", "/interact/vote")).toHaveLength(0);
    expect(backend.blockedRequests).toEqual([]);
  });
}
