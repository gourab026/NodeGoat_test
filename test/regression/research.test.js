"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function request(query) {
    const filename = path.resolve(__dirname, "../../app/routes/research.js");
    const actualRequire = createRequire(filename);
    const module = { exports: {} };
    const result = {};
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
        module, require: name => name === "needle" ? { get(url, callback) {
            result.fetched = url; callback(null, { statusCode: 200 }, "remote body");
        } } : actualRequire(name)
    }, { filename });
    const res = { status(code) { result.status = code; return res; },
        send(message) { result.message = message; }, redirect(url) { result.location = url; },
        render(view) { result.view = view; }, writeHead() {}, write() {}, end() {} };
    new module.exports({}).displayResearch({ query }, res);
    return result;
}

test("research ignores caller-supplied URLs and only opens Yahoo's stock page", () => {
    const result = request({ symbol: "AAPL", url: "http://127.0.0.1/private?" });
    assert.equal(result.fetched, undefined);
    assert.equal(result.location, "https://finance.yahoo.com/quote/AAPL");
});

test("research rejects malformed and non-string symbols", () => {
    for (const symbol of ["//phishing.example", "<script>", "../../admin", ["AAPL"], { name: "AAPL" }]) {
        assert.equal(request({ symbol }).status, 400);
    }
    assert.equal(request({}).view, "research");
});
