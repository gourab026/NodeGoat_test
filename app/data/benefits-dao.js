"use strict";

const { callbackify } = require("node:util");
const { userId } = require("./validation");

function BenefitsDAO(db) {
    if (!(this instanceof BenefitsDAO)) return new BenefitsDAO(db);
    const users = db.collection("users");
    this.getAllNonAdminUsers = callbackify(async () => users.find({ isAdmin: { $ne: true } }).toArray());
    this.updateBenefits = callbackify(async (value, startDate) => {
        if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            throw new Error("Invalid benefits date");
        }
        return users.updateOne({ _id: userId(value) }, { $set: { benefitStartDate: startDate } });
    });
}

module.exports = { BenefitsDAO };
