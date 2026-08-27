import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, username, full_name, email FROM users'));
}
run();
