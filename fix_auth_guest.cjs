const fs = require('fs');
let content = fs.readFileSync('server/routes/auth.ts', 'utf8');

// Replace the email check and logic
const findStr = `    const firebase_uid = decodedToken.uid;
    const email = decodedToken.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Token không chứa email' });
    }

    const db = getTargetFirestore();
    let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');`;

const replaceStr = `    const firebase_uid = decodedToken.uid;
    const isAnonymous = decodedToken.provider_id === 'anonymous' || !decodedToken.email;
    const email = decodedToken.email?.toLowerCase() || \`guest_\${firebase_uid}@anonymous.local\`;

    const db = getTargetFirestore();
    let username = isAnonymous ? \`guest_\${firebase_uid.slice(0, 8)}\` : email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');`;

content = content.replace(findStr, replaceStr);

// Now update the registration logic
const findStr2 = `    if (!userDoc.exists) {
      // 6. REGISTER: role: VIEWER, status: PENDING
      const status = 'PENDING';
      const role = 'VIEWER';`;

const replaceStr2 = `    if (!userDoc.exists) {
      // 6. REGISTER: role: VIEWER, status: ACTIVE for guest, PENDING for normal
      const status = isAnonymous ? 'ACTIVE' : 'PENDING';
      const role = 'VIEWER';`;
content = content.replace(findStr2, replaceStr2);

const findStr3 = `        roles: [role],
        status: status,
        isActive: false,`;
const replaceStr3 = `        roles: [role],
        status: status,
        isActive: isAnonymous ? true : false,`;
content = content.replace(findStr3, replaceStr3);

fs.writeFileSync('server/routes/auth.ts', content);
