const fs = require('fs');
let code = fs.readFileSync('server/routes/feeders.ts', 'utf8');

const oldCheck = `          // Verify devices dependency (simplified for this cutover)
          // ... need to verify active devices
          
          try {
              const deleted = await feederRepo.delete(id, operationId);`;

const newCheck = `          // Verify devices dependency
          const deviceCount = await deviceRepo.count({ feeder_id: id });
          if (deviceCount > 0) return res.status(409).json({ success: false, code: 'FEEDER_HAS_ACTIVE_DEVICES', message: 'Phát tuyến đang có thiết bị hoạt động.' });
          
          try {
              const deleted = await feederRepo.delete(id, operationId);`;

code = code.replace(oldCheck, newCheck);

fs.writeFileSync('server/routes/feeders.ts', code);
console.log('Patched feeder soft delete dependency check');
