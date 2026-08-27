import { getDb, dbQuery } from './server/db';
async function run() {
  await getDb();
  console.log(dbQuery("PRAGMA table_info(substations);"));
}
run();
