const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('grid_management.sqlite');

db.all("PRAGMA table_info(loops)", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(rows);
});
db.close();
