const fs = require('fs');
let code = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

code = code.replace(/const totalEquipmentCount = devices\.length > 0 \? devices\.length : \(stats\?\.total_equipment \?\? 0\);/g, "const totalEquipmentCount = stats?.total_equipment ?? 0;");
code = code.replace(/const totalSubstationsCount = substations\.length > 0 \? substations\.length : \(stats\?\.total_stations_110kv \?\? 0\);/g, "const totalSubstationsCount = stats?.total_stations_110kv ?? 0;");
code = code.replace(/const totalFeedersCount = feeders\.length > 0 \? feeders\.length : \(stats\?\.total_feeders \?\? 0\);/g, "const totalFeedersCount = stats?.total_feeders ?? 0;");

// Update any places where device.length or feeders.length is used directly for counts if possible, but the variables above are the main ones.

fs.writeFileSync('src/pages/DashboardPage.tsx', code);
