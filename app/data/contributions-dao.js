"use strict";

const { callbackify } = require("node:util");
const { userId } = require("./validation");

function ContributionsDAO(db) {
    if (!(this instanceof ContributionsDAO)) return new ContributionsDAO(db);
    const contributions = db.collection("contributions");
    const withUser = async document => {
        const user = await db.collection("users").findOne({ _id: document.userId });
        if (!user) throw new Error("User not found");
        return { ...document, userName: user.userName, firstName: user.firstName, lastName: user.lastName };
    };
    this.update = callbackify(async (value, preTax, afterTax, roth) => {
        if ([preTax, afterTax, roth].some(amount => !Number.isInteger(amount) || amount < 0) ||
            preTax + afterTax + roth > 30) {
            throw new Error("Invalid contribution percentages");
        }
        const document = { userId: userId(value), preTax, afterTax, roth };
        await contributions.updateOne({ userId: document.userId }, { $set: document }, { upsert: true });
        return withUser(document);
    });
    this.getByUserId = callbackify(async value => {
        const id = userId(value);
        const document = await contributions.findOne({ userId: id }) || { userId: id, preTax: 2, afterTax: 2, roth: 2 };
        return withUser(document);
    });
}

module.exports = { ContributionsDAO };
