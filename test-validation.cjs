const { validatePayload } = require('./dist/server.cjs').__get_validatePayload ? require('./dist/server.cjs') : {};
// The compiled server doesn't export validatePayload easily unless I compile it differently.
// Let's just use ts-node or run it natively.
