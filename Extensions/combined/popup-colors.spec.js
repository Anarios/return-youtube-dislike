/** @jest-environment jsdom */
const fs = require("fs");
const path = require("path");

jest.mock("./src/consent-prompt", () => ({ waitForCoreDataConsent: () => new Promise(() => {}) }));
jest.mock("./src/core-data-consent", () => ({ onCoreDataPermissionChanged: jest.fn() }));

const customColors = {
  light: { like: "#123456", dislike: "#654321" },
  dark: { like: "#abcdef", dislike: "#fedcba" },
};
const defaultColors = {
  light: { like: "#007600", dislike: "#b300b3" },
  dark: { like: "#00d000", dislike: "#ff77ff" },
};

describe("popup color settings", () => {
  let storageListener;
  let completeColorRead;

  function openPopup(saved = {}, delayColors = false) {
    jest.resetModules();
    const stored = { numberDisplayFormat: "compactShort", hideClutterButtons: false, ...saved };
    const messages = require("./_locales/en/messages.json");
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
    global.chrome = {
      i18n: { getMessage: (key) => messages[key]?.message || "" },
      runtime: { getManifest: () => ({ version: "1.0.0" }) },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            const result = Object.fromEntries(keys.map((key) => [key, stored[key]]));
            if (delayColors && keys.includes("customColors")) completeColorRead = () => callback(result);
            else callback(result);
          }),
          set: jest.fn((values) => Object.assign(stored, values)),
        },
        onChanged: { addListener: (listener) => (storageListener = listener) },
      },
    };
    require("./popup");
    return stored;
  }

  function chooseTheme(theme) {
    const select = document.getElementById("color_theme");
    select.value = theme;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function changeColor(mode, vote, value, eventName = "change") {
    const input = document.getElementById(`custom_color_${mode}_${vote}`);
    input.value = value;
    input.dispatchEvent(new Event(eventName, { bubbles: true }));
  }

  function expectPreview(mode, vote, color) {
    const probe = document.createElement("span");
    probe.style.backgroundColor = color;
    expect(document.getElementById(`color_theme_example_${mode}_${vote}`).style.backgroundColor).toBe(
      probe.style.backgroundColor,
    );
  }

  afterEach(() => {
    delete global.chrome;
    jest.restoreAllMocks();
  });

  test("keeps existing presets and classic default while adding Hibiscus and Custom", () => {
    openPopup();
    const select = document.getElementById("color_theme");
    expect(Array.from(select.options, (option) => option.value)).toEqual([
      "classic",
      "accessible",
      "neon",
      "hibiscus",
      "custom",
    ]);
    expect(Array.from(select.options, (option) => option.textContent.trim())).toEqual([
      "Classic",
      "Accessible",
      "Neon",
      "Hibiscus",
      "Custom",
    ]);
    expect(select.value).toBe("classic");
    expect(document.getElementById("custom_colors_light").hidden).toBe(true);
    expect(document.getElementById("custom_colors_dark").hidden).toBe(true);
    expectPreview("light", "like", "lime");
    expectPreview("dark", "dislike", "red");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test("uses the default number format before first-run storage is initialized", () => {
    expect(() => openPopup({ numberDisplayFormat: undefined })).not.toThrow();
    expect(document.getElementById("number_format").value).toBe("compactShort");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test("uses a keyboard-compatible change event for preset selection and previews both themes", () => {
    openPopup();
    chooseTheme("hibiscus");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ colorTheme: "hibiscus" });
    for (const mode of ["light", "dark"]) {
      for (const vote of ["like", "dislike"]) expectPreview(mode, vote, defaultColors[mode][vote]);
    }
  });

  test("restores separate light and dark pickers with associated labels and theme groups", () => {
    openPopup({ colorTheme: "custom", customColors });
    for (const mode of ["light", "dark"]) {
      expect(document.getElementById(`custom_colors_${mode}`).hidden).toBe(false);
      for (const vote of ["like", "dislike"]) {
        const input = document.getElementById(`custom_color_${mode}_${vote}`);
        expect(input.type).toBe("color");
        expect(input.value).toBe(customColors[mode][vote]);
        expect(input.disabled).toBe(false);
        expect(input.tabIndex).toBe(0);
        expect(input.labels[0].textContent.trim()).toBe(vote === "like" ? "Like" : "Dislike");
        expect(input.closest("fieldset").querySelector("legend").textContent).toBe(
          mode === "light" ? "Light YouTube theme" : "Dark YouTube theme",
        );
        expectPreview(mode, vote, customColors[mode][vote]);
      }
    }
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test("previews picker input immediately and saves the complete palette on change", () => {
    openPopup({ colorTheme: "custom", customColors });
    changeColor("dark", "like", "#112233", "input");
    expectPreview("dark", "like", "#112233");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    changeColor("dark", "like", "#112233");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      customColors: { ...customColors, dark: { ...customColors.dark, like: "#112233" } },
    });
    expectPreview("light", "like", customColors.light.like);
  });

  test("retains custom colors when choosing a preset and when the popup reopens", () => {
    const stored = openPopup({ colorTheme: "custom", customColors });
    changeColor("light", "dislike", "#225588");
    chooseTheme("neon");
    expect(document.getElementById("custom_colors_light").hidden).toBe(true);
    expectPreview("light", "dislike", "magenta");
    openPopup(stored);
    chooseTheme("custom");
    expect(document.getElementById("custom_color_light_dislike").value).toBe("#225588");
    expectPreview("light", "dislike", "#225588");
    expect(document.getElementById("custom_color_dark_dislike").value).toBe(customColors.dark.dislike);
  });

  test("applies sync changes without rewriting stored values and ignores unrelated storage areas", () => {
    openPopup({ colorTheme: "classic" });
    storageListener({ colorTheme: { newValue: "custom" }, customColors: { newValue: customColors } }, "sync");
    expect(document.getElementById("color_theme").value).toBe("custom");
    expectPreview("dark", "dislike", customColors.dark.dislike);
    storageListener({ colorTheme: { newValue: "neon" }, customColors: { newValue: defaultColors } }, "local");
    expect(document.getElementById("color_theme").value).toBe("custom");
    expectPreview("dark", "dislike", customColors.dark.dislike);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  test("normalizes incomplete or removed custom colors and falls back from unknown presets", () => {
    openPopup({ colorTheme: "custom", customColors: { light: { like: "#123456", dislike: "red" } } });
    expectPreview("light", "like", "#123456");
    expectPreview("light", "dislike", defaultColors.light.dislike);
    expectPreview("dark", "like", defaultColors.dark.like);
    storageListener({ customColors: { newValue: undefined } }, "sync");
    expectPreview("light", "like", defaultColors.light.like);
    storageListener({ colorTheme: { newValue: "unknown" } }, "sync");
    expect(document.getElementById("color_theme").value).toBe("classic");
    expectPreview("light", "like", "lime");
  });

  test("waits for stored colors before permitting an edit", () => {
    openPopup({ colorTheme: "custom", customColors }, true);
    chooseTheme("custom");
    const input = document.getElementById("custom_color_light_like");
    expect(input.disabled).toBe(true);
    chrome.storage.sync.set.mockClear();
    changeColor("light", "like", "#112233");
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    completeColorRead();
    expect(input.disabled).toBe(false);
    expect(input.value).toBe(customColors.light.like);
  });

  test("does not overwrite a theme chosen while the initial color read is pending", () => {
    openPopup({ colorTheme: "neon", customColors }, true);
    chooseTheme("custom");
    completeColorRead();
    expect(document.getElementById("color_theme").value).toBe("custom");
    expect(document.getElementById("custom_color_dark_like").value).toBe(customColors.dark.like);
    expectPreview("dark", "like", customColors.dark.like);
  });

  test("does not overwrite newer sync colors with an older pending read", () => {
    openPopup({ colorTheme: "custom", customColors: defaultColors }, true);
    storageListener({ customColors: { newValue: customColors } }, "sync");
    completeColorRead();
    expect(document.getElementById("color_theme").value).toBe("custom");
    expectPreview("light", "like", customColors.light.like);
    expect(document.getElementById("custom_color_dark_dislike").value).toBe(customColors.dark.dislike);
  });

  test("does not overwrite a newer sync theme while still restoring the stored colors", () => {
    openPopup({ colorTheme: "classic", customColors }, true);
    storageListener({ colorTheme: { newValue: "custom" } }, "sync");
    completeColorRead();
    expect(document.getElementById("color_theme").value).toBe("custom");
    expectPreview("light", "dislike", customColors.light.dislike);
  });
});
