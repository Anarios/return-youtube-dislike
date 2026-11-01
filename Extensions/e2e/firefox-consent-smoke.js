const net = require("node:net");
const { spawn } = require("node:child_process");
const { until } = require("./feature-permissions-fixtures");

class Marionette {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.sequence = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve) => (this.connected = resolve));
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.includes(58)) {
        const colon = this.buffer.indexOf(58);
        const length = Number(this.buffer.subarray(0, colon).toString());
        if (this.buffer.length < colon + 1 + length) return;
        const message = JSON.parse(this.buffer.subarray(colon + 1, colon + 1 + length));
        this.buffer = this.buffer.subarray(colon + 1 + length);
        if (!Array.isArray(message)) this.connected(message);
        else {
          const [, id, error, result] = message;
          const pending = this.pending.get(id);
          if (!pending) continue;
          this.pending.delete(id);
          clearTimeout(pending.timer);
          error ? pending.reject(new Error(JSON.stringify(error))) : pending.resolve(result);
        }
      }
    });
    socket.on("error", () => {});
  }

  command(name, parameters = {}) {
    const id = ++this.sequence;
    const message = JSON.stringify([0, id, name, parameters]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out: ${name}`)), 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.write(`${Buffer.byteLength(message)}:${message}`);
    });
  }

  async script(script, args = [], async = false) {
    const response = await this.command(async ? "WebDriver:ExecuteAsyncScript" : "WebDriver:ExecuteScript", {
      script,
      args,
      newSandbox: false,
      sandbox: null,
      line: 1,
      filename: "firefox-consent-smoke.js",
      scriptTimeout: 25000,
    });
    return response.value;
  }

  async context(value) {
    await this.command("Marionette:SetContext", { value });
  }

  async click(selector) {
    const element = await this.command("WebDriver:FindElement", { using: "css selector", value: selector });
    await this.command("WebDriver:ElementClick", { id: element.value["element-6066-11e4-a52e-4f735466cecf"] });
  }
}

async function connectMarionette(port, description) {
  return until(
    async () => {
      try {
        const socket = await new Promise((resolve, reject) => {
          const client = net.connect(port, "127.0.0.1", () => resolve(client));
          client.once("error", reject);
        });
        const driver = new Marionette(socket);
        await driver.ready;
        return driver;
      } catch {
        return false;
      }
    },
    description,
    20000,
  );
}

async function readNativePermissionPrompt(driver) {
  await driver.context("chrome");
  return driver.script(
    'const notification=document.getElementById("addon-webext-permissions-notification");const active=PopupNotifications.getNotification("addon-webext-permissions",gBrowser.selectedBrowser);if(document.getElementById("notification-popup")?.state!=="open"||!notification||notification.hidden||!active||notification.notification!==active)return null;const list=document.getElementById("addon-webext-perm-list-data-collection");return{labels:[...(list?.querySelectorAll("li")||[])].map(item=>item.textContent.trim()),text:list?.textContent.trim()||"",heading:notification.getAttribute("endlabel"),html:notification.outerHTML};',
  );
}

async function chooseNativePermission(driver, allow) {
  await driver.context("chrome");
  await driver.script("document.querySelector(arguments[0]).click();", [
    "#addon-webext-permissions-notification .popup-notification-" + (allow ? "primary" : "secondary") + "-button",
  ]);
}

async function selectCurrentTab(driver) {
  await driver.context("content");
  await driver.script(
    'const done=arguments[arguments.length-1];if(typeof browser!=="undefined"&&browser.tabs?.getCurrent){browser.tabs.getCurrent().then(tab=>browser.tabs.update(tab.id,{active:true})).then(()=>done(true));}else done(true);',
    [],
    true,
  );
}

function spawnHeadlessFirefox(profile) {
  return spawn(
    process.env.RYD_FIREFOX_BINARY || "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    ["-headless", "-no-remote", "-profile", profile, "--marionette", "--remote-allow-system-access", "about:blank"],
    {
      windowsHide: true,
      env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

const run = (...args) => require("./firefox-feature-permissions").run(...args);
module.exports = {
  Marionette,
  chooseNativePermission,
  connectMarionette,
  readNativePermissionPrompt,
  run,
  selectCurrentTab,
  spawnHeadlessFirefox,
};

if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
