"use strict";

const { callbackify } = require("node:util");
const { userId, stockThreshold } = require("./validation");

function AllocationsDAO(db) {
    if (!(this instanceof AllocationsDAO)) return new AllocationsDAO(db);
    const allocations = db.collection("allocations");
    const withUser = async allocation => {
        const user = await db.collection("users").findOne({ _id: allocation.userId });
        if (!user) throw new Error("User not found");
        return { ...allocation, userName: user.userName, firstName: user.firstName, lastName: user.lastName };
    };

    this.update = callbackify(async (value, stocks, funds, bonds) => {
        const document = { userId: userId(value), stocks, funds, bonds };
        await allocations.updateOne({ userId: document.userId }, { $set: document }, { upsert: true });
        return withUser(document);
    });

    this.getByUserIdAndThreshold = callbackify(async (value, threshold) => {
        const query = { userId: userId(value) };
        const numericThreshold = stockThreshold(threshold);
        if (numericThreshold !== undefined) query.stocks = { $gt: numericThreshold };
        const documents = await allocations.find(query).toArray();
        return Promise.all(documents.map(withUser));
    });
}

module.exports = { AllocationsDAO };
