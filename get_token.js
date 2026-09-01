const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 1, username: 'admin', roles: ['ADMIN'] }, 'SUPER_SECRET_KEY_2025', { expiresIn: '24h' });
console.log(token);
