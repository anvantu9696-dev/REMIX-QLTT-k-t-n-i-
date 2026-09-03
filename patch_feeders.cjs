const fs = require('fs');
let code = fs.readFileSync('server/routes/feeders.ts', 'utf8');

const replaceOld = `        const [feeders, substations] = await Promise.all([
          feederRepo.list({
            substation_id: substation_id ? (substation_id as string) : undefined,
            status: status ? (status as string) : undefined,
            limit: Number(limit) || 10,
            lastDocId: lastDocId ? (lastDocId as string) : undefined
          }),
          substationRepo.list()
        ]);
        
        const subMap = new Map(substations.map(s => [String(s.id), s]));`;

const replaceNew = `        const feeders = await feederRepo.list({
            substation_id: substation_id ? (substation_id as string) : undefined,
            status: status ? (status as string) : undefined,
            limit: Number(limit) || 10,
            lastDocId: lastDocId ? (lastDocId as string) : undefined
        });
        
        const subIdsToFetch = Array.from(new Set(feeders.map(f => String(f.substation_id)).filter(id => id && id !== 'undefined' && id !== 'null')));
        const substations = await Promise.all(subIdsToFetch.map(id => substationRepo.getById(id)));
        const subMap = new Map(substations.filter(s => s).map(s => [String(s!.id), s]));`;

code = code.replace(replaceOld, replaceNew);

fs.writeFileSync('server/routes/feeders.ts', code);
console.log('Patched feeders route');
