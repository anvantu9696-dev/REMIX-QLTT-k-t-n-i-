const fs = require('fs');
const initSqlJs = require('sql.js');

async function run() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('data/sqlite.db');
  const db = new SQL.Database(fileBuffer);
  const res = db.exec("SELECT id, username, full_name FROM users");
  console.log(JSON.stringify(res, null, 2));
  const resRoles = db.exec("SELECT * FROM user_roles");
  console.log(JSON.stringify(resRoles, null, 2));
  const roles = db.exec("SELECT * FROM roles");
  console.log(JSON.stringify(roles, null, 2));
}
run();
