"use strict";

const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");

class ZapClient {
    constructor(origin, apiKey, transport = global.fetch) {
        this.origin = new URL(origin);
        if (!["http:", "https:"].includes(this.origin.protocol) || this.origin.username || this.origin.password) {
            throw new Error("Invalid ZAP API origin");
        }
        if (!apiKey) throw new Error("ZAP_API_KEY is required");
        this.apiKey = apiKey;
        this.transport = transport;
    }

    async request(format, component, type, name, params = {}) {
        if (![format, component, type, name].every(value => /^[A-Za-z]+$/.test(value))) {
            throw new Error("Invalid ZAP API operation");
        }
        const url = new URL(`/${format}/${component}/${type}/${name}/`, this.origin);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
        const response = await this.transport(url, {
            headers: { "X-ZAP-API-Key": this.apiKey }, redirect: "error",
            signal: global.AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(`ZAP HTTP failure for ${component}/${name}`);
        return response;
    }

    async call(component, type, name, params) {
        const response = await this.request("JSON", component, type, name, params);
        const result = await response.json();
        if (!result || result.code) throw new Error(`ZAP rejected ${component}/${name}`);
        return result;
    }

    async report() {
        const response = await this.request("OTHER", "core", "other", "htmlreport");
        const html = await response.text();
        if (!/<!doctype html|<html/i.test(html)) throw new Error("ZAP did not return an HTML report");
        return html;
    }
}

function numericResult(value, field) {
    if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) {
        throw new Error(`Invalid ZAP ${field}`);
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid ZAP ${field}`);
    return number;
}

async function waitFor(api, component, name, params, field, complete, options) {
    const deadline = Date.now() + options.timeout;
    while (Date.now() < deadline) {
        const result = await api.call(component, "view", name, params);
        const value = numericResult(result[field], field);
        if (value === complete) return;
        await delay(options.interval);
    }
    throw new Error(`ZAP ${component} timed out`);
}

async function scanProfile(api, options) {
    const { target, userName, password, writeReport } = options;
    const polling = { interval: options.interval === undefined ? 2000 : options.interval,
        timeout: options.timeout === undefined ? 10 * 60 * 1000 : options.timeout };
    const contextName = `NodeGoat-${Date.now()}`;
    const { contextId } = await api.call("context", "action", "newContext", { contextName });
    if (!contextId) throw new Error("ZAP did not create a context");
    let activeId;
    let spiderId;
    try {
        await api.call("context", "action", "includeInContext", {
            contextName, regex: "\\Q" + target + "\\E.*"
        });
        await api.call("context", "action", "excludeFromContext", {
            contextName, regex: "\\Q" + target + "logout\\E.*"
        });
        await api.call("context", "action", "setContextInScope", { contextName, booleanInScope: true });
        await api.call("sessionManagement", "action", "setSessionManagementMethod", {
            contextId, methodName: "cookieBasedSessionManagement", methodConfigParams: ""
        });
        await api.call("authentication", "action", "setAuthenticationMethod", {
            contextId, authMethodName: "formBasedAuthentication",
            authMethodConfigParams: "loginUrl=" + target + "login&loginRequestData=" +
                encodeURIComponent("userName={%username%}&password={%password%}")
        });
        await api.call("authentication", "action", "setLoggedInIndicator", {
            contextId, loggedInIndicatorRegex: "\\Q/logout\\E"
        });
        await api.call("authentication", "action", "setLoggedOutIndicator", {
            contextId, loggedOutIndicatorRegex: "\\Qname=\"password\"\\E"
        });
        const { userId } = await api.call("users", "action", "newUser", { contextId, name: userName });
        if (!userId) throw new Error("ZAP did not create a user");
        await api.call("users", "action", "setAuthenticationCredentials", {
            contextId, userId,
            authCredentialsConfigParams: new URLSearchParams({ username: userName, password }).toString()
        });
        await api.call("users", "action", "setUserEnabled", { contextId, userId, enabled: true });
        await api.call("forcedUser", "action", "setForcedUser", { contextId, userId });
        await api.call("forcedUser", "action", "setForcedUserModeEnabled", { boolean: true });
        const spider = await api.call("spider", "action", "scanAsUser", {
            contextId, userId, url: target, maxChildren: 1, recurse: true
        });
        spiderId = spider.scan;
        if (!spiderId) throw new Error("ZAP did not start the spider");
        await waitFor(api, "spider", "status", { scanId: spiderId }, "status", 100, polling);
        spiderId = undefined;
        const active = await api.call("ascan", "action", "scan", {
            url: target + "profile", recurse: true, inScopeOnly: true, contextId, method: "POST",
            postData: new URLSearchParams({ firstName: "John", lastName: "Doe", ssn: "seleniumSSN",
                dob: "12/23/5678", bankAcc: "seleniumBankAcc", bankRouting: "0198212#",
                address: "seleniumAddress", submit: "" }).toString()
        });
        activeId = active.scan;
        if (!activeId) throw new Error("ZAP did not start the active scan");
        await waitFor(api, "ascan", "status", { scanId: activeId }, "status", 100, polling);
        activeId = undefined;
        await waitFor(api, "pscan", "recordsToScan", {}, "recordsToScan", 0, polling);
        await writeReport(await api.report());
        const alerts = await api.call("core", "view", "numberOfAlerts", { baseurl: target + "profile" });
        const count = numericResult(alerts.numberOfAlerts, "alert count");
        assert.ok(count <= 3, `${count} alerts exceed the existing profile threshold of 3; inspect the report`);
        return count;
    } finally {
        if (spiderId) await api.call("spider", "action", "stop", { scanId: spiderId });
        if (activeId) await api.call("ascan", "action", "stop", { scanId: activeId });
        await api.call("forcedUser", "action", "setForcedUserModeEnabled", { boolean: false });
    }
}

module.exports = { ZapClient, scanProfile };
