const fs = require('fs');
let code = fs.readFileSync('server/routes/devices.ts', 'utf8');

const replaceOld = `        // 1. Trong GET /api/devices, bỏ cách tải cố định 100 trạm/phát tuyến; chỉ truy vấn đúng các ID xuất hiện trên trang thiết bị
        const subIdsToFetch = Array.from(new Set(devices.map(d => String(d.substation_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        const feederIdsToFetch = Array.from(new Set(devices.map(d => String(d.feeder_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        
        const substations = await Promise.all(subIdsToFetch.map(id => substationRepo.getById(id)));
        const feeders = await Promise.all(feederIdsToFetch.map(id => feederRepo.getById(id)));
        
        const subMap = new Map(substations.filter(s => s).map(s => [String(s!.id), s]));
        const feederMap = new Map(feeders.filter(f => f).map(f => [String(f!.id), f]));

        let enrichedDevices = devices.map(d => {
            const sub = subMap.get(String(d.substation_id));
            const feeder = feederMap.get(String(d.feeder_id));
            return {
                ...d,
                substation_name: sub ? sub.name : null,
                substation_code: sub ? sub.substation_code : null,
                feeder_name: feeder ? feeder.name : null,
                feeder_code: feeder ? feeder.feeder_code : null,
                device_type: d.device_type === 'RCL' ? 'REC' : d.device_type
            };
        });`;

const replaceNew = `        // Lấy danh sách ID trạm/phát tuyến CẦN FETCH (nếu document chưa được chuẩn hóa)
        const subIdsToFetch = Array.from(new Set(devices.filter(d => !d.substation_name).map(d => String(d.substation_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        const feederIdsToFetch = Array.from(new Set(devices.filter(d => !d.feeder_name).map(d => String(d.feeder_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        
        const substations = await Promise.all(subIdsToFetch.map(id => substationRepo.getById(id)));
        const feeders = await Promise.all(feederIdsToFetch.map(id => feederRepo.getById(id)));
        
        const subMap = new Map(substations.filter(s => s).map(s => [String(s!.id), s]));
        const feederMap = new Map(feeders.filter(f => f).map(f => [String(f!.id), f]));

        let enrichedDevices = devices.map(d => {
            const sub = subMap.get(String(d.substation_id));
            const feeder = feederMap.get(String(d.feeder_id));
            return {
                ...d,
                substation_name: d.substation_name || (sub ? sub.name : null),
                substation_code: d.substation_code || (sub ? sub.substation_code : null),
                feeder_name: d.feeder_name || (feeder ? feeder.name : null),
                feeder_code: d.feeder_code || (feeder ? feeder.feeder_code : null),
                device_type: d.device_type === 'RCL' ? 'REC' : d.device_type
            };
        });`;

code = code.replace(replaceOld, replaceNew);

fs.writeFileSync('server/routes/devices.ts', code);
console.log('Patched devices.ts');
