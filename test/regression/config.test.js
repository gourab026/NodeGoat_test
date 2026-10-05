"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Isolate environment variables and capture logs without loading app dependencies.
function loadConfig(env) {
    const logs = [];
    function load(filename) {
        const module = { exports: {} };
        vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
            module, __dirname: path.dirname(filename), process: { env },
            console: { log: (...args) => logs.push(args.join(" ")) },
            require: name => name === "underscore" ? {} :
                path.isAbsolute(name) ? load(name) : require(name)
        }, { filename });
        return module.exports;
    }
    return { config: load(path.resolve(__dirname, "../../config/config.js")), logs };
}

test("production rejects a missing or short session secret", () => {
    for (const secret of [undefined, "short"]) {
        assert.throws(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: secret }),
            /SESSION_SECRET/);
    }
});

test("configured credentials are loaded from the environment and never logged", () => {
    const secret = "a".repeat(64);
    const { config, logs } = loadConfig({ NODE_ENV: "test", SESSION_SECRET: secret,
        ZAP_API_KEY: "test-only-zap-credential", CRYPTO_KEY: "test-only-encryption-credential" });
    assert.equal(config.cookieSecret, secret);
    assert.equal(config.zapApiKey, "test-only-zap-credential");
    assert.equal(config.cryptoKey, "test-only-encryption-credential");
    assert.equal(logs.length, 0);
});

test("local development gets a fresh high entropy secret on each start", () => {
    const first = loadConfig({ NODE_ENV: "development" }).config.cookieSecret;
    const second = loadConfig({ NODE_ENV: "development" }).config.cookieSecret;
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.notEqual(first, second);
});

test("configuration only loads known environment names", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "../../server" }), /NODE_ENV/);
});
