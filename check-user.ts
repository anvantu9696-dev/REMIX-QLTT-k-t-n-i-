import { getDb, dbQuery, dbQueryOne } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, username, full_name, email FROM users WHERE full_name LIKE "%Test Role%" OR username LIKE "%Test Role%"'));
}
run();
