const { JWT_SECRET } = require('./dist/server.cjs') || { JWT_SECRET: 'super-secret-key-for-dev-env-2025' };
console.log(JWT_SECRET);
