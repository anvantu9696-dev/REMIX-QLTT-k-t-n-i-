const fs = require('fs');
const glob = require('glob');

const repos = [
  'server/repositories/firestore/substationRepository.ts',
  'server/repositories/firestore/feederRepository.ts',
  'server/repositories/firestore/loopRepository.ts'
];

for (const repo of repos) {
  if (fs.existsSync(repo)) {
    let content = fs.readFileSync(repo, 'utf8');
    
    // For substation
    if (repo.includes('substationRepository')) {
      content = content.replace(/if \(options\?.limit\) \{/g, `const limit = options?.limit || 500;
    if (limit) {
      query = query.limit(limit);`);
      content = content.replace(/query = query\.limit\(options\.limit\);/g, ''); // we already replaced it above
    }
    
    // For feeder
    if (repo.includes('feederRepository')) {
      content = content.replace(/if \(options\?.limit\) \{/g, `const limit = options?.limit || 500;
    if (limit) {
      query = query.limit(limit);`);
      content = content.replace(/query = query\.limit\(options\.limit\);/g, ''); // we already replaced it above
    }

    // For loop
    if (repo.includes('loopRepository')) {
      content = content.replace(/if \(options\?.limit\) \{/g, `const limit = options?.limit || 500;
    if (limit) {
      query = query.limit(limit);`);
      content = content.replace(/query = query\.limit\(options\.limit\);/g, ''); // we already replaced it above
    }

    fs.writeFileSync(repo, content, 'utf8');
  }
}
