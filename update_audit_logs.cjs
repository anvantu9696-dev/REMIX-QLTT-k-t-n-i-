const fs = require('fs');
let code = fs.readFileSync('server/routes/auditLogs.ts', 'utf8');

code = code.replace(/let parsedLimit = parseInt\(limit as string, 10\) \|\| 5000;[\s\S]*?if \(hasMore\) {[\s\S]*?logs\.pop\(\);[\s\S]*?}/, 
`let parsedLimit = parseInt(limit as string, 10) || 50;
    if (lastDocId) {
      const lastDoc = await db.collection('audit_logs').doc(lastDocId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }
    const snap = await query.limit(parsedLimit + 1).get();
    let logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    if (search) {
      const term = (search as string).toLowerCase();
      logs = logs.filter(l => 
        (l.username && l.username.toLowerCase().includes(term)) ||
        (l.user_fullname && l.user_fullname.toLowerCase().includes(term)) ||
        (l.details && l.details.toLowerCase().includes(term)) ||
        (l.target_id && String(l.target_id).toLowerCase().includes(term))
      );
    }
    const hasMore = logs.length > parsedLimit;
    if (hasMore) {
        logs.pop();
    }`);

fs.writeFileSync('server/routes/auditLogs.ts', code);
