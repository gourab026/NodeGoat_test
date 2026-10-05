"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Dependencies aren't installed in the offline workspace. Load the real route
// registration with stand-ins for unrelated handlers and the Express app.
function learnHandler() {
    const module = { exports: {} };
    const handlers = {};
    const filename = path.resolve(__dirname, "../../app/routes/index.js");
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
        module, Map, require: name => name === "../../config/config" ? { environmentalScripts: [] } :
            name === "./error" ? { errorHandler() {} } :
            name === "./tutorial" ? {} : function Handler() {}
    }, { filename });
    module.exports({ get: (route, ...callbacks) => { handlers[route] = callbacks.at(-1); },
        post() {}, use() {} }, {});
    return handlers["/learn"];
}

function responseTo(url) {
    const result = {};
    const res = { redirect: target => { result.location = target; },
        render: (view, data) => { result.view = view; result.data = data; },
        status: code => { result.status = code; return res; },
        send: message => { result.message = message; return res; } };
    learnHandler()({ query: { url } }, res);
    return result;
}

test("learning links retain the existing dashboard and Khan Academy targets", () => {
    for (const target of ["/dashboard",
        "https://www.khanacademy.org/economics-finance-domain/core-finance/" +
            "investment-vehicles-tutorial/ira-401ks/v/traditional-iras"]) {
        const result = responseTo(target);
        assert.equal(result.location, undefined);
        assert.equal(result.view, "learning");
        assert.equal(result.data.destination, target);
    }
});

test("learning links reject external, malformed, and ambiguous destinations", () => {
    for (const target of ["https://phishing.example", "//phishing.example", "/\\phishing.example",
        ["javascript", "alert(1)"].join(":"), "/dashboard?next=https://phishing.example", undefined,
        ["/dashboard", "https://phishing.example"], { toString: () => "/dashboard" },
        "https://www.khanacademy.org@phishing.example/", "__proto__"]) {
        const response = responseTo(target);
        assert.equal(response.status, 400, String(target));
        assert.equal(response.location, undefined);
    }
});
