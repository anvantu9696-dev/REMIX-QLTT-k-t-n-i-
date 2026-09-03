const fs = require('fs');
let code = fs.readFileSync('server/routes/substations.ts', 'utf8');

const oldCheck = `          // Verify dependencies
          const activeFeeders = await feederRepo.list();
          const hasFeeders = activeFeeders.some((f: any) => String(f.substation_id) === String(id));

          if (hasFeeders) return res.status(409).json({ success: false, code: 'SUBSTATION_HAS_ACTIVE_FEEDERS', message: 'Trạm đang có phát tuyến hoạt động.' });`;

const newCheck = `          // Verify dependencies
          const feedersCount = await feederRepo.count({ substation_id: id });
          if (feedersCount > 0) return res.status(409).json({ success: false, code: 'SUBSTATION_HAS_ACTIVE_FEEDERS', message: 'Trạm đang có phát tuyến hoạt động.' });`;

code = code.replace(oldCheck, newCheck);

fs.writeFileSync('server/routes/substations.ts', code);
console.log('Patched substation soft delete dependency check');
