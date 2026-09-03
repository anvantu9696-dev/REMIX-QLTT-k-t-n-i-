const fs = require('fs');
let code = fs.readFileSync('server/routes/substations.ts', 'utf8');

const oldList = `        let substations = await substationRepo.list({ status: status as string });`;
const newList = `        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const lastDocId = req.query.lastDocId as string | undefined;
        let substations = await substationRepo.list({ status: status as string, limit, lastDocId });`;

code = code.replace(oldList, newList);

// Also need to add nextCursor
const oldReturn = `        return res.json({ success: true, data: substations });`;
const newReturn = `        const nextCursor = substations.length > 0 ? substations[substations.length - 1].id : null;
        return res.json({ success: true, data: substations, nextCursor });`;
        
code = code.replace(oldReturn, newReturn);

fs.writeFileSync('server/routes/substations.ts', code);
console.log('Patched substation route for pagination');
