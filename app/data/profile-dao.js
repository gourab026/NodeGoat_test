"use strict";

const { callbackify } = require("node:util");
const { userId } = require("./validation");

function ProfileDAO(db) {
    if (!(this instanceof ProfileDAO)) return new ProfileDAO(db);
    const users = db.collection("users");
    this.updateUser = callbackify(async (value, firstName, lastName, ssn, dob, address, bankAcc, bankRouting) => {
        const profile = {};
        for (const [key, field] of Object.entries({ firstName, lastName, ssn, dob, address, bankAcc, bankRouting })) {
            if (field !== undefined && typeof field !== "string") throw new Error("Invalid profile input");
            if (field) profile[key] = field;
        }
        await users.updateOne({ _id: userId(value) }, { $set: profile });
        return profile;
    });
    this.getByUserId = callbackify(async value => {
        const user = await users.findOne({ _id: userId(value) });
        if (!user) throw new Error("User not found");
        return user;
    });
}

module.exports = { ProfileDAO };
