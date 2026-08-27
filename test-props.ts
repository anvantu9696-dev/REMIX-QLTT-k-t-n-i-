import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, status, type, requester_unit, requester_team FROM device_proposals'));
  console.log('---');
  console.log(dbQuery('SELECT id, username, unit, team FROM users WHERE username = "nv_vanhanh1"')); // or the current user
}
run();
