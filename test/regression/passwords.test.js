"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { hashPassword, verifyPassword } = require("../../app/security/passwords");

test("password hashes have unique salts and authenticate Unicode credentials", async () => {
    const password = "Grüße-🔐-password";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    assert.notEqual(first, second);
    assert.ok(await verifyPassword(password, first));
    assert.equal(await verifyPassword("wrong", first), false);
});

test("malformed hashes and non-string inputs cannot authenticate", async () => {
    assert.equal(await verifyPassword("scrypt$invalid", "scrypt$invalid"), false);
    assert.equal(await verifyPassword({ $ne: null }, "legacy-password"), false);
    assert.equal(await verifyPassword("password", undefined), false);
    await assert.rejects(hashPassword("x".repeat(1025)), /Invalid password/);
});
