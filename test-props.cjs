const { dbQuery } = require('./server/db');
console.log(dbQuery('SELECT * FROM device_proposals'));
