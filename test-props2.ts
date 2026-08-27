import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, username, unit, team, email FROM users'));
  console.log('---');
  console.log(dbQuery('SELECT * FROM user_scopes'));
}
run();
