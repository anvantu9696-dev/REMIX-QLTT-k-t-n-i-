import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT * FROM users WHERE email = "anvantu9696@gmail.com"'));
  console.log(dbQuery('SELECT * FROM user_scopes WHERE user_id = (SELECT id FROM users WHERE email = "anvantu9696@gmail.com")'));
}
run();
