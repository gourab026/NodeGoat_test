"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const memoryDb = require("../helpers/memory-db");
const { resetDatabase } = require("../../artifacts/db-reset");
const { verifyPassword, isPasswordHash } = require("../../app/security/passwords");

test("database seeding completes counters, hashed demo accounts, and balanced allocations", async () => {
    const db = memoryDb();
    await resetDatabase(db);
    assert.equal(db.data.counters[0].seq, 3);
    assert.equal(db.data.users.length, 3);
    assert.ok(db.data.users.every(user => isPasswordHash(user.password)));
    assert.ok(await verifyPassword("User1_123", db.data.users.find(user => user.userName === "user1").password));
    assert.equal(db.data.allocations.length, 3);
    assert.ok(db.data.allocations.every(allocation => allocation.stocks + allocation.funds + allocation.bonds === 100));
});

test("database seeding does not swallow permission errors while dropping collections", async () => {
    const db = memoryDb({ users: [{ _id: 2, userName: "existing" }] });
    db.dropCollection = async () => { const error = new Error("permission denied"); error.code = 13; throw error; };
    await assert.rejects(resetDatabase(db), /permission denied/);
    assert.equal(db.data.users[0].userName, "existing");
});
