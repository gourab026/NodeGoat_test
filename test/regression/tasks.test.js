"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

function tasks(exitCode = 0) {
    const registered = {};
    const invocations = [];
    const module = { exports: {} };
    const childProcess = {
        exec(command, callback) { invocations.push({ shell: command }); callback(null, "", ""); },
        spawn(command, args, options) {
            invocations.push({ command, args, options });
            const child = new EventEmitter();
            process.nextTick(() => child.emit("close", exitCode));
            return child;
        }
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../Gruntfile.js"), "utf8"), {
        module, process, __dirname: path.resolve(__dirname, "../.."),
        require: name => name === "child_process" || name === "node:child_process" ? childProcess : require(name)
    });
    module.exports({ file: { readJSON() { return {}; } }, initConfig() {}, loadNpmTasks() {}, option() {},
        log: { error() {}, ok() {} },
        registerTask(name, description, task) { registered[name] = task || description; } });
    return { registered, invocations };
}

test("database reset runs Node directly with an isolated environment variable", async () => {
    const { registered, invocations } = tasks();
    const success = await new Promise(resolve => registered["db-reset"].call({ async: () => resolve }, "test"));
    assert.equal(success, true);
    assert.equal(invocations.length, 1);
    assert.equal(invocations[0].command, process.execPath);
    assert.equal(invocations[0].options.env.NODE_ENV, process.env.NODE_ENV || "test");
    assert.equal(invocations[0].shell, undefined);
});

test("a failing database seed fails the task instead of reporting success", async () => {
    const { registered } = tasks(1);
    const success = await new Promise(resolve => registered["db-reset"].call({ async: () => resolve }, "test"));
    assert.equal(success, false);
});
