const { dbQueryOne, getDb } = require('./server/db');
async function run() {
  await getDb();
  let email = "anvantu@gmail.com";
  let sqliteUser = dbQueryOne(`
      SELECT u.id, u.status, u.username, u.full_name, r.code as roleCode
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.email = ? AND u.deleted_at IS NULL
    `, [email]);
  console.log("sqliteUser:", sqliteUser);
}
run();
