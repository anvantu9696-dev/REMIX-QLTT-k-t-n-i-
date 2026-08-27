import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, code, name, status FROM substations'));
}
run();
