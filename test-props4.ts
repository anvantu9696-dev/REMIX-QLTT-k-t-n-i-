import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, username, email, full_name FROM users ORDER BY id DESC LIMIT 5'));
}
run();
