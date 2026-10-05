// default app configuration
const port = process.env.PORT || 4000;
let db = process.env.MONGODB_URI || "mongodb://localhost:27017/nodegoat";

module.exports = {
    port,
    db,
    cookieSecret: "session_cookie_secret_key_here", // nosemgrep
    cryptoKey: "a_secure_key_for_crypto_here", // nosemgrep
    cryptoAlgo: "aes256",
    hostName: "localhost",
    environmentalScripts: []
};

