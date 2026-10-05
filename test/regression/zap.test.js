"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ZapClient, scanProfile } = require("../../artifacts/zap-scan");

test("ZAP API requests encode values, keep keys out of URLs, and reject redirects and API errors", async () => {
    let request;
    const api = new ZapClient("http://localhost:8080", "test-key", async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ Result: "OK" }) };
    });
    await api.call("users", "action", "setAuthenticationCredentials", { authCredentialsConfigParams: "a&b=1" });
    assert.equal(request.url.searchParams.get("authCredentialsConfigParams"), "a&b=1");
    assert.ok(!request.url.href.includes("test-key"));
    assert.equal(request.options.headers["X-ZAP-API-Key"], "test-key");
    assert.equal(request.options.redirect, "error");
    const failed = new ZapClient("http://localhost:8080", "test-key", async () => ({
        ok: true, json: async () => ({ code: "bad_apikey", message: "sensitive details" })
    }));
    await assert.rejects(failed.call("core", "view", "version"), /ZAP rejected/);
});

test("ZAP scanning awaits authenticated spider and active scans and writes report before alert failure", async () => {
    const calls = [];
    const api = { async call(component, type, name, params) {
        calls.push({ component, type, name, params });
        if (name === "newContext") return { contextId: "7" };
        if (name === "newUser") return { userId: "9" };
        if (name === "scanAsUser" || name === "scan") return { scan: "1" };
        if (name === "status") return { status: "100" };
        if (name === "recordsToScan") return { recordsToScan: "0" };
        if (name === "numberOfAlerts") return { numberOfAlerts: "4" };
        return { Result: "OK" };
    }, async report() { return "<html>report</html>"; } };
    let report;
    await assert.rejects(scanProfile(api, { target: "http://localhost:4000/", userName: "user1",
        password: "test-password", writeReport: async html => { report = html; }, interval: 0 }), /4 alerts/);
    assert.equal(report, "<html>report</html>");
    const spider = calls.findIndex(call => call.component === "spider" && call.name === "scanAsUser");
    const waited = calls.findIndex(call => call.component === "spider" && call.name === "status");
    const active = calls.findIndex(call => call.component === "ascan" && call.name === "scan");
    assert.ok(spider < waited && waited < active);
    assert.equal(calls[active].params.method, "POST");
    assert.equal(calls[active].params.contextId, "7");
    assert.equal(calls.find(call => call.name === "includeInContext").params.contextName,
        calls.find(call => call.name === "newContext").params.contextName);
    assert.ok(calls.some(call => call.name === "setForcedUser" && call.params.userId === "9"));
    assert.equal(calls.at(-1).name, "setForcedUserModeEnabled");
    assert.equal(calls.at(-1).params.boolean, false);
});

test("ZAP API failures stop the scan rather than reporting success", async () => {
    const api = { async call() { throw new Error("Connection refused"); } };
    await assert.rejects(scanProfile(api, { target: "http://localhost:4000/" }), /Connection refused/);
});
