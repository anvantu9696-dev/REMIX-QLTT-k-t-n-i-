const { dbQuery, getDb } = require('./server/db');
async function run() {
  await getDb();
  const users = dbQuery(`
    SELECT u.id, u.employee_code, u.full_name, u.username
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE u.deleted_at IS NULL 
      AND u.status = 'ACTIVE'
      AND r.code = 'STAFF'
    GROUP BY u.id
  `);
  console.log(users);
}
run();
