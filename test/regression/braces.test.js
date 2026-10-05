"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const braces = require("braces");
const micromatch = require("micromatch");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { patchBraces } = require("../../artifacts/patch-braces");

test("brace compilation and expansion reject excessive nesting before exhausting the stack", () => {
    const pattern = "{".repeat(4000) + "a,b" + "}".repeat(4000);
    for (const operation of [braces.parse, braces.compile, braces.expand]) {
        assert.throws(() => operation(pattern), error => error instanceof SyntaxError &&
            error.message.includes("security limit"));
    }
});

test("brace AST walkers also bound nesting supplied directly", () => {
    const ast = { type: "root", nodes: [] };
    let node = ast;
    for (let index = 0; index < 5000; index++) {
        const child = { type: "brace", nodes: [], commas: 1, ranges: 0 };
        node.nodes.push(child);
        node = child;
    }
    node.nodes.push({ type: "text", value: "a" });
    for (const operation of [braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => operation(ast), error => error instanceof SyntaxError &&
            error.message.includes("security limit"));
    }
});

test("ordinary brace lists, ranges, nested patterns and micromatch keep working", () => {
    assert.deepEqual(braces.expand("app/{data,routes}/*.js"), ["app/data/*.js", "app/routes/*.js"]);
    assert.deepEqual(braces.expand("file-{1..3}.js"), ["file-1.js", "file-2.js", "file-3.js"]);
    assert.deepEqual(braces.expand("{a,{b,c}}"), ["a", "b", "c"]);
    assert.equal(braces.compile("{a,b}"), "(a|b)");
    assert.deepEqual(micromatch(["app/data/user.js", "app/routes/login.js", "app/views/login.html"],
        "app/{data,routes}/*.js"), ["app/data/user.js", "app/routes/login.js"]);
});

test("dependency repair is repeatable and rejects unexpected upstream source", () => {
    assert.equal(patchBraces(), 0);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "braces-repair-"));
    try {
        const folder = path.join(root, "node_modules/braces");
        fs.cpSync(path.dirname(require.resolve("braces/package.json")), folder, { recursive: true });
        fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({
            packages: { "node_modules/braces": { version: "3.0.3" } }
        }));
        assert.equal(patchBraces(root), 0);
        fs.appendFileSync(path.join(folder, "lib/stringify.js"), "\n// unexpected source change\n");
        assert.throws(() => patchBraces(root), /Unrecognized braces source/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
