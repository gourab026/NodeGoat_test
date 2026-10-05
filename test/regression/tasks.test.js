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
    const taskRequire = name => name === "child_process" || name === "node:child_process" ?
        childProcess : require(name);
    taskRequire.resolve = require.resolve;
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../Gruntfile.js"), "utf8"), {
        module, process, __dirname: path.resolve(__dirname, "../.."),
        require: taskRequire
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

test("Grunt uses the maintained Nodemon CLI and native security test runner", async () => {
    const { registered, invocations } = tasks();
    for (const name of ["nodemon", "run-security-tests"]) {
        assert.equal(await new Promise(resolve => registered[name].call({ async: () => resolve })), true);
    }
    assert.equal(invocations[0].command, process.execPath);
    assert.equal(invocations[0].args[0], require.resolve("nodemon/bin/nodemon.js"));
    assert.deepEqual(Array.from(invocations[1].args), ["--test", "test/security/*.js"]);
    assert.deepEqual(Array.from(registered.testsecurity), ["env:test", "run-security-tests"]);
});
