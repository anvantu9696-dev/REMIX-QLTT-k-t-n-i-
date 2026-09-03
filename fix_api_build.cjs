const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const endIdx = code.indexOf('const API_BASE');
if (endIdx !== -1) {
    code = `import { getCache, setCache, invalidateCacheByPrefix, clearAllCache, invalidateRelatedDeviceCache } from './idbCache';\nimport { AuthSession, User, AuditLog, Notification, DocumentItem, GuideItem, DashboardStats, SystemBackup } from '../types';\n\n` + code.substring(endIdx);
}
fs.writeFileSync('src/lib/api.ts', code);
console.log('Fixed api.ts');
