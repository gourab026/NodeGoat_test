"use strict";

const { randomBytes, scrypt, timingSafeEqual, createHash } = require("node:crypto");
const { promisify } = require("node:util");
const deriveKey = promisify(scrypt);
// One of OWASP's equivalent minimum scrypt configurations (32 MiB per hash).
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = "scrypt$32768$8$3$";

async function hashPassword(password) {
    if (typeof password !== "string" || !password || password.length > 1024) throw new Error("Invalid password");
    const salt = randomBytes(16).toString("hex");
    const hash = await deriveKey(password, salt, 64, options);
    return `${prefix}${salt}$${hash.toString("hex")}`;
}

function isPasswordHash(stored) {
    return typeof stored === "string" && /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored);
}

async function verifyPassword(password, stored) {
    if (typeof password !== "string" || password.length > 1024 || typeof stored !== "string") return false;
    if (isPasswordHash(stored)) {
        const parts = stored.split("$");
        const actual = await deriveKey(password, parts[4], 64, options);
        return timingSafeEqual(actual, Buffer.from(parts[5], "hex"));
    }
    // Existing plaintext accounts are rehashed by the DAO after successful login.
    // Malformed hash records must never become valid plaintext credentials.
    if (stored.startsWith("scrypt$")) return false;
    const digest = value => createHash("sha256").update(value).digest();
    return timingSafeEqual(digest(password), digest(stored));
}

module.exports = { hashPassword, verifyPassword, isPasswordHash };
