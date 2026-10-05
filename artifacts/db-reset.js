#!/usr/bin/env node
"use strict";

const { hashPassword } = require("../app/security/passwords");

// These are documented demonstration accounts. Passwords are hashed before
// insertion; database credentials and password hashes are never logged.
const users = [
    { _id: 1, userName: "admin", firstName: "Node Goat", lastName: "Admin", password: "Admin_123", isAdmin: true },
    { _id: 2, userName: "user1", firstName: "John", lastName: "Doe",
        benefitStartDate: "2030-01-10", password: "User1_123" },
    { _id: 3, userName: "user2", firstName: "Will", lastName: "Smith",
        benefitStartDate: "2025-11-30", password: "User2_123" }
];

async function resetDatabase(db) {
    // Prepare hashes before dropping data, so a hashing error doesn't erase it.
    const documents = [];
    for (const user of users) documents.push({ ...user, password: await hashPassword(user.password) });
    for (const name of ["users", "allocations", "contributions", "memos", "counters"]) {
        try { await db.dropCollection(name); }
        catch (error) { if (error.code !== 26) throw error; } // NamespaceNotFound is expected on first seed.
    }
    await db.collection("counters").insertOne({ _id: "userId", seq: 3 });
    await db.collection("users").insertMany(documents);
    const allocations = documents.map(user => {
        const stocks = Math.floor(Math.random() * 40) + 1;
        const funds = Math.floor(Math.random() * 40) + 1;
        return { userId: user._id, stocks, funds, bonds: 100 - stocks - funds };
    });
    await db.collection("allocations").insertMany(allocations);
}

async function main() {
    const { MongoClient } = require("mongodb");
    const config = require("../config/config");
    const client = new MongoClient(config.db, { serverSelectionTimeoutMS: 10000 });
    try {
        await client.connect();
        await resetDatabase(client.db());
        console.log("Database reset performed successfully");
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    main().catch(() => {
        console.error("Database reset failed; check database connectivity and permissions");
        process.exitCode = 1;
    });
}

module.exports = { resetDatabase };
