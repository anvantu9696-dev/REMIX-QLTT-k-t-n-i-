const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{tsx,ts}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace hasPermission in useAuth destructuring
  content = content.replace(/hasPermission(,?)/g, (match, p1) => {
    return 'hasRole' + p1;
  });

  // Replace specific permissions
  content = content.replace(/hasRole\('equipment:create'\)/g, "(hasRole('ADMIN') || hasRole('MANAGER'))");
  content = content.replace(/hasRole\('equipment:update'\)/g, "(hasRole('ADMIN') || hasRole('MANAGER'))");
  content = content.replace(/hasRole\('equipment:delete'\)/g, "hasRole('ADMIN')");
  
  content = content.replace(/hasRole\('GRID_DATA_IMPORT'\)/g, "hasRole('ADMIN')");
  content = content.replace(/hasRole\('MANAGE_LOOPS'\)/g, "(hasRole('ADMIN') || hasRole('MANAGER'))");
  content = content.replace(/hasRole\('EDIT_TOPOLOGY'\)/g, "(hasRole('ADMIN') || hasRole('MANAGER'))");
  content = content.replace(/hasRole\('PERIODIC_INSPECTION_DELETE'\)/g, "hasRole('ADMIN')");
  content = content.replace(/hasRole\('audit:read'\)/g, "hasRole('ADMIN')");
  content = content.replace(/hasRole\('documents:create'\)/g, "(hasRole('ADMIN') || hasRole('MANAGER'))");
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
