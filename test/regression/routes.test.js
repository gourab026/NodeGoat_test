"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const memoryDb = require("../helpers/memory-db");
const AllocationsHandler = require("../../app/routes/allocations");
const ProfileHandler = require("../../app/routes/profile");
const SessionHandler = require("../../app/routes/session");
const registerRoutes = require("../../app/routes");

const database = () => memoryDb({ users: [
    { _id: 2, userName: "employee", firstName: "Ada", password: "existing-password" },
    { _id: 3, userName: "other", firstName: "Grace" }], allocations: [{ userId: 3, stocks: 50 }] });

function response(resolve) {
    const result = {};
    const res = { status(code) { result.status = code; return res; },
        send(body) { result.body = body; resolve(result); return res; },
        render(view, data) { resolve({ ...result, view, data }); },
        redirect(location) { resolve({ ...result, location }); } };
    return res;
}

function updateProfile(bankRouting) {
    return new Promise((resolve, reject) => {
        new ProfileHandler(database()).handleProfileUpdate({ session: { userId: 2 },
            body: { firstName: "Ada", bankRouting } }, response(resolve), reject);
    });
}

function runHandlers(route) {
    return new Promise((resolve, reject) => {
        const req = { session: { userId: 2 } };
        const res = response(resolve);
        let position = 0;
        const next = error => error ? reject(error) : route.handlers[position++](req, res, next);
        next();
    });
}

test("an employee cannot view another employee's allocations", async () => {
    const result = await new Promise((resolve, reject) => {
        new AllocationsHandler(database()).displayAllocations({ params: { userId: "3" },
            session: { userId: 2 }, query: {} }, response(resolve), reject);
    });
    assert.equal(result.status, 403);
    assert.equal(result.view, undefined);
});

test("profile routing numbers reject suffix garbage and non-string inputs", async () => {
    for (const bankRouting of ["123#garbage", ["123#"], "x".repeat(10000)]) {
        const result = await updateProfile(bankRouting);
        assert.equal(result.view, "profile");
        assert.ok(result.data.updateError);
        assert.equal(result.data.firstName, "Ada");
    }
});

test("benefits routes enforce administrator authorization", async () => {
    const routes = [];
    registerRoutes({ get: (path, ...handlers) => routes.push({ path, handlers }),
        post: (path, ...handlers) => routes.push({ path, handlers }), use() {} }, database());
    for (const route of routes.filter(route => route.path === "/benefits")) {
        const result = await runHandlers(route);
        assert.equal(result.status, 403);
    }
});

test("login renews and saves the session before redirecting", async () => {
    const req = { body: { userName: "employee", password: "existing-password" }, session: {} };
    let regenerated = false;
    let saved = false;
    req.session.regenerate = callback => {
        regenerated = true;
        req.session = { save(done) { assert.equal(req.session.userId, 2); saved = true; done(); } };
        callback();
    };
    const result = await new Promise((resolve, reject) => {
        new SessionHandler(database()).handleLoginRequest(req, response(resolve), reject);
    });
    assert.ok(regenerated);
    assert.ok(saved);
    assert.equal(result.location, "/dashboard");
});

test("signup provisions allocations before establishing the session", async () => {
    const db = memoryDb({ counters: [{ _id: "userId", seq: 3 }] });
    const req = { body: { userName: "new-user", firstName: "Ada", lastName: "Lovelace",
        password: "pass123456", verify: "pass123456", email: "" }, session: {} };
    req.session.regenerate = callback => {
        db.collection("allocations").findOne({ userId: 4 }).then(allocation => {
            assert.ok(allocation);
            req.session = { save(done) { done(); } };
            callback();
        }).catch(callback);
    };
    const result = await new Promise((resolve, reject) => {
        new SessionHandler(db).handleSignup(req, response(resolve), reject);
    });
    assert.equal(result.view, "dashboard");
    assert.equal(req.session.userId, 4);
});

test("signup forwards allocation failures without rendering success", async () => {
    const db = memoryDb({ counters: [{ _id: "userId", seq: 3 }] });
    const originalCollection = db.collection;
    db.collection = name => name === "allocations" ? {
        async updateOne() { throw new Error("Write denied"); }
    } : originalCollection(name);
    const req = { body: { userName: "new-user", firstName: "Ada", lastName: "Lovelace",
        password: "pass123456", verify: "pass123456", email: "" },
    session: { regenerate() { assert.fail("Cannot authenticate before provisioning succeeds"); } } };
    await assert.rejects(new Promise((resolve, reject) => {
        new SessionHandler(db).handleSignup(req, response(resolve), reject);
    }), /Write denied/);
});
