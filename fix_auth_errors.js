const fs = require('fs');

// Fix LoginPage
let loginFile = fs.readFileSync('src/pages/LoginPage.tsx', 'utf8');
loginFile = loginFile.replace("import { useNavigate } from 'react-router-dom';", "");
loginFile = loginFile.replace("const navigate = useNavigate();\n", "");
loginFile = loginFile.replace("navigate('/');", "// App.tsx will automatically re-render when user is populated");
fs.writeFileSync('src/pages/LoginPage.tsx', loginFile);

// Fix AuthContext
let authContextFile = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
authContextFile = authContextFile.replace(
  "roles: data.roles || (data.role ? [data.role] : []),",
  "roles: data.roles || (data.role ? [data.role] : []),\n              phone: data.phone || '',\n              created_at: data.createdAt || data.created_at || new Date().toISOString(),\n              updated_at: data.updatedAt || data.updated_at || new Date().toISOString(),"
);
fs.writeFileSync('src/context/AuthContext.tsx', authContextFile);
