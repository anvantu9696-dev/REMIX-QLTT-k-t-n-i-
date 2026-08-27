import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery('SELECT id, substation_code, name, deleted_at FROM substations'));
}
run();
