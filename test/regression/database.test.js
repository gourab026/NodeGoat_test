"use strict";

const assert = require("node:assert/strict");
const nodeTest = require("node:test");
const test = (name, fn) => nodeTest(name, { timeout: 10000 }, fn);
const memoryDb = require("../helpers/memory-db");
const { UserDAO } = require("../../app/data/user-dao");
const { AllocationsDAO } = require("../../app/data/allocations-dao");
const { BenefitsDAO } = require("../../app/data/benefits-dao");
const { ContributionsDAO } = require("../../app/data/contributions-dao");
const { ProfileDAO } = require("../../app/data/profile-dao");
const { MemosDAO } = require("../../app/data/memos-dao");

const call = (object, method, ...args) => new Promise((resolve, reject) => {
    object[method](...args, (err, value) => err ? reject(err) : resolve(value));
});
const user = { _id: 2, userName: "employee", firstName: "Ada", lastName: "Lovelace", password: "existing-password" };
const database = () => memoryDb({ users: [user, { _id: 1, userName: "admin", isAdmin: true }],
    counters: [{ _id: "userId", seq: 2 }], allocations: [{ userId: 2, stocks: 40, funds: 30, bonds: 30 }] });

test("signup, sequence allocation, and existing login use promise-based database operations", async () => {
    const db = database();
    const dao = new UserDAO(db);
    const added = await call(dao, "addUser", "new-user", "Grace", "Hopper", "new-password", "grace@example.com");
    assert.equal(added._id, 3);
    assert.equal(db.data.users.at(-1).userName, "new-user");
    assert.notEqual(db.data.users.at(-1).password, "new-password");
    assert.equal((await call(dao, "validateLogin", "new-user", "new-password"))._id, 3);
    assert.equal((await call(dao, "validateLogin", "employee", "existing-password"))._id, 2);
    assert.notEqual(db.data.users[0].password, "existing-password");
    await assert.rejects(call(dao, "validateLogin", "employee", "incorrect"), /Invalid password/);
});

test("login rejects query operator injection before database access", async () => {
    const dao = new UserDAO(database());
    await assert.rejects(call(dao, "validateLogin", { $ne: null }, "existing-password"), /Invalid/);
});

test("user lookups and missing counters fail predictably", async () => {
    const db = database();
    const dao = new UserDAO(db);
    assert.equal((await call(dao, "getUserById", "2")).firstName, "Ada");
    assert.equal((await call(dao, "getUserByUserName", "employee"))._id, 2);
    await assert.rejects(call(dao, "getNextSequence", "missing"), /counter/i);
    await assert.rejects(call(dao, "getUserById", "2junk"), /user/i);
});

test("allocations filter numerically without evaluating JavaScript", async () => {
    const dao = new AllocationsDAO(database());
    const results = await call(dao, "getByUserIdAndThreshold", 2, "30");
    assert.equal(results.length, 1);
    assert.equal(results[0].firstName, "Ada");
    assert.equal((await call(dao, "getByUserIdAndThreshold", 2, "50")).length, 0);
    for (const value of ["0';while(true){}'", "-1", "101", ["0"], { $gt: 0 }]) {
        await assert.rejects(call(dao, "getByUserIdAndThreshold", 2, value), /threshold/i);
    }
});

test("an allocation update calls back once and preserves other document fields", async () => {
    const db = database();
    db.data.allocations[0].note = "keep";
    const dao = new AllocationsDAO(db);
    let callbacks = 0;
    await new Promise((resolve, reject) => {
        dao.update("2", 50, 25, 25, (error, value) => {
            callbacks++;
            if (error) return reject(error);
            assert.equal(value.firstName, "Ada");
            resolve();
        });
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(callbacks, 1);
    assert.equal(db.data.allocations.length, 1);
    assert.equal(db.data.allocations[0].userId, 2);
    assert.equal(db.data.allocations[0].note, "keep");
});

test("benefits updates and non-admin listings preserve role boundaries", async () => {
    const db = database();
    const dao = new BenefitsDAO(db);
    await call(dao, "updateBenefits", "2", "2030-01-10");
    const users = await call(dao, "getAllNonAdminUsers");
    assert.equal(users.length, 1);
    assert.equal(users[0].benefitStartDate, "2030-01-10");
});

test("contributions upsert uses numeric IDs and preserves defaults", async () => {
    const db = database();
    const dao = new ContributionsDAO(db);
    assert.equal((await call(dao, "getByUserId", "2")).preTax, 2);
    await call(dao, "update", "2", 5, 3, 2);
    await call(dao, "update", 2, 6, 3, 2);
    assert.equal(db.data.contributions.length, 1);
    assert.equal((await call(dao, "getByUserId", "2")).preTax, 6);
});

test("profile updates preserve identity and unrelated fields", async () => {
    const db = database();
    const dao = new ProfileDAO(db);
    await call(dao, "updateUser", "2", "Augusta", "Lovelace", "123", "2000-01-01", "London", "456", "123#");
    const profile = await call(dao, "getByUserId", 2);
    assert.equal(profile.firstName, "Augusta");
    assert.equal(profile.password, "existing-password");
    assert.equal(profile.ssn, "123");
});

test("memos insert and list in descending timestamp order", async () => {
    const db = database();
    const dao = new MemosDAO(db);
    await call(dao, "insert", "first");
    db.data.memos[0].timestamp = new Date("2020-01-01");
    await call(dao, "insert", "second");
    assert.deepEqual((await call(dao, "getAllMemos")).map(row => row.memo), ["second", "first"]);
});

test("database failures are forwarded to callbacks", async () => {
    const db = { collection: () => ({ find: () => ({
        toArray: async () => { throw new Error("database unavailable"); }
    }) }) };
    await assert.rejects(call(new BenefitsDAO(db), "getAllNonAdminUsers"), /database unavailable/);
});
