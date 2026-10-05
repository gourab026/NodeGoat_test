"use strict";

const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");
const { defineConfig } = require("cypress");
const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const proxy = require("selenium-webdriver/proxy");
const { patchBraces } = require("./patch-braces");

assert.equal(patchBraces(undefined, false), 0, "Run npm run patch:dependencies before checking installed tooling");

const config = defineConfig(require("../cypress.config"));
assert.equal(config.e2e.specPattern, "test/e2e/integration/**/*_spec.js");
assert.equal(typeof config.e2e.setupNodeEvents, "function");
// Configure the real modern builder without starting or downloading a browser.
new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options().addArguments("--headless=new"))
    .setChromeService(new chrome.ServiceBuilder()).setProxy(proxy.manual({ http: "localhost:8080" }));

// Verify get-uri resolves the patched FTP client and its retained calling APIs.
const uriRequire = createRequire(require.resolve("get-uri"));
const ftpVersion = uriRequire("basic-ftp/package.json").version.split(".").map(Number);
assert.ok(ftpVersion[0] >= 6 && (ftpVersion[0] > 6 || ftpVersion[1] > 2 ||
    (ftpVersion[1] === 2 && ftpVersion[2] >= 2)), "The patched basic-ftp >=6.2.2 must be installed");
const client = new (uriRequire("basic-ftp").Client)();
for (const name of ["access", "lastMod", "list", "downloadTo", "close"]) {
    assert.equal(typeof client[name], "function", name);
}
client.close();

const audit = spawnSync(process.execPath, [require.resolve("retire/lib/cli.js"), "--help"], {
    encoding: "utf8", timeout: 10000
});
assert.equal(audit.status, 0, audit.stderr || "Retire CLI failed to load");
console.log("Cypress configuration, Selenium builder, FTP client, and Retire CLI loaded successfully");
