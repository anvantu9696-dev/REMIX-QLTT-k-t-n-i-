import fs from 'fs';
const data = JSON.parse(fs.readFileSync('backup_sqlite_2026-08-26T15-28-32-595Z.json', 'utf-8'));
let total = 0;
for (const table in data) {
    console.log(`${table}: ${data[table].length}`);
    total += data[table].length;
}
console.log(`Total: ${total}`);
