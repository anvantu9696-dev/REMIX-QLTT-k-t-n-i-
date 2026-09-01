const fs = require('fs');
let code = fs.readFileSync('server/middleware.ts', 'utf8');
code = code.replace("import jwt from 'jsonwebtoken';", "import jwt from 'jsonwebtoken';\nimport { getTargetAuth } from './firebaseAdmin.js';");
code = code.replace(
  "export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {",
  "export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {"
);
code = code.replace(
  "    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };\n    \n    // Fetch fresh user from DB\n    const userRow = dbQueryOne(\n      `SELECT id, username, employee_code, full_name, email, unit, team, title, status \n       FROM users WHERE id = ? AND deleted_at IS NULL`,\n      [decoded.userId]\n    );",
  `    let decodedToken;
    try {
      decodedToken = await getTargetAuth().verifyIdToken(token);
    } catch (e) {
      // Fallback to JWT if needed (for legacy tests/guest tokens)
      decodedToken = jwt.verify(token, JWT_SECRET) as any;
    }
    
    // Fetch fresh user from DB
    const email = decodedToken.email;
    let userRow;
    if (email) {
      userRow = dbQueryOne(
        \`SELECT id, username, employee_code, full_name, email, unit, team, title, status 
         FROM users WHERE email = ? AND deleted_at IS NULL\`,
        [email]
      );
    } else if (decodedToken.userId) {
      userRow = dbQueryOne(
        \`SELECT id, username, employee_code, full_name, email, unit, team, title, status 
         FROM users WHERE id = ? AND deleted_at IS NULL\`,
        [decodedToken.userId]
      );
    }`
);
fs.writeFileSync('server/middleware.ts', code);
