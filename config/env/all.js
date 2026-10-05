// default app configuration
const { randomBytes } = require("crypto");
const port = process.env.PORT || 4000;
let db = process.env.MONGODB_URI || "mongodb://localhost:27017/nodegoat";
let cookieSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && (!cookieSecret || cookieSecret.length < 32)) {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production");
}
// Local sessions expire on restart unless a stable secret is supplied.
cookieSecret = cookieSecret || randomBytes(32).toString("hex");

module.exports = {
    port,
    db,
    cookieSecret,
    cryptoKey: process.env.CRYPTO_KEY,
    cryptoAlgo: "aes256",
    hostName: "localhost",
    environmentalScripts: []
};
