"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const memoryDb = require("../helpers/memory-db");

function application() {
    const { createApp } = require("../../app/application");
    return createApp(memoryDb());
}

const render = (app, view, data = {}) => new Promise((resolve, reject) => {
    app.render(view, data, (error, html) => error ? reject(error) : resolve(html));
});

test("signup and login escape values in quoted attributes and error messages", async () => {
    const app = application();
    const attack = "\"><img src=x onerror=alert(1)>";
    for (const view of ["signup", "login"]) {
        const html = await render(app, view, { userName: attack, userNameError: attack, loginError: attack });
        assert.ok(!html.includes(attack));
        assert.ok(html.includes("&lt;img"));
    }
});

test("profile preserves escaped names and builds a fixed HTTPS search link", async () => {
    const html = await render(application(), "profile", { firstName: "Ada & Grace", userId: 2 });
    assert.match(html, /name="firstName" value="Ada &amp; Grace"/);
    assert.match(html, /href="https:\/\/www\.google\.com\/search\?q=Ada%20%26%20Grace"/);
});

test("memos retain Markdown formatting while escaping raw HTML and unsafe links", async () => {
    const html = await render(application(), "memos", { userId: 2,
        memosList: [{ memo: "**Bold**\n\n<script>alert(1)</script>\n\n" +
            "[x](javascript:alert(1))\n\n[Safe](https://example.com)" }] });
    assert.ok(html.includes("<strong>Bold</strong>"));
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(!html.includes("href=\"javascript:"));
    assert.ok(html.includes("href=\"https://example.com\""));
});

test("all application and tutorial templates render after the engine migration", async () => {
    const app = application();
    const root = path.resolve(__dirname, "../../app/views");
    for (const filename of fs.readdirSync(root, { recursive: true }).filter(name => name.endsWith(".html"))) {
        const html = await render(app, filename, { user: { isAdmin: false }, userId: 2, firstName: "Ada",
            allocations: [], users: [], memosList: [], environmentalScripts: [] });
        assert.ok(html.includes("<html"), filename);
        assert.ok(html.includes("</html>"), filename);
    }
});
