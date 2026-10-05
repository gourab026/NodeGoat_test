"use strict";

function userId(value) {
    if ((typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && !/^[1-9]\d*$/.test(value))) {
        throw new Error("Invalid user ID");
    }
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid user ID");
    return id;
}

function stockThreshold(value) {
    if (value === undefined || value === "") return undefined;
    if ((typeof value !== "number" && typeof value !== "string") ||
        (typeof value === "string" && !/^(?:0|[1-9]\d?|100)$/.test(value))) {
        throw new Error("Invalid stock threshold");
    }
    const threshold = Number(value);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
        throw new Error("Invalid stock threshold");
    }
    return threshold;
}

module.exports = { userId, stockThreshold };
