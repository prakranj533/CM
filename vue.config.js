// Vue CLI 4 ships webpack 4, which hashes with md4. OpenSSL 3 (Node 17+)
// removed md4, so any build crashes with ERR_OSSL_EVP_UNSUPPORTED.
// Alias md4 to md5 so the toolchain runs on modern Node without NODE_OPTIONS.
const crypto = require("crypto");

const createHash = crypto.createHash;
crypto.createHash = (algorithm, options) =>
  createHash(algorithm === "md4" ? "md5" : algorithm, options);

module.exports = {};
