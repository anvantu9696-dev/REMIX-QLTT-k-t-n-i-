const fs = require('fs');

const filesToUpdate = [
  'src/components/devices/DeviceCard.tsx',
  'src/pages/DevicesPage.tsx',
  'src/pages/DocumentsPage.tsx',
  'src/pages/SubstationsPage.tsx',
  'src/pages/LoopsPage.tsx',
  'src/pages/LoopDetailPage.tsx',
  'src/pages/FeedersPage.tsx',
];

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content;
    // Replace hasRole('MANAGER') with (hasRole('MANAGER') || hasRole('SHIFT_LEADER'))
    // Wait, the regex should just look for hasRole('MANAGER') and replace it carefully.
    // If it's already (hasRole('ADMIN') || hasRole('MANAGER')), it becomes (hasRole('ADMIN') || (hasRole('MANAGER') || hasRole('SHIFT_LEADER'))) which is fine.
    
    // Instead of simple replace, let's use a while loop for global replacement
    newContent = newContent.replace(/hasRole\('MANAGER'\)/g, "(hasRole('MANAGER') || hasRole('SHIFT_LEADER'))");
    
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
}
