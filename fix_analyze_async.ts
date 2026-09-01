import fs from 'fs';

let content = fs.readFileSync('server/routes/import.ts', 'utf8');

content = content.replace(
    /router\.post\('\/analyze', requirePermission\('GRID_DATA_IMPORT'\), \(req: AuthenticatedRequest, res\) => \{/g,
    `router.post('/analyze', requirePermission('GRID_DATA_IMPORT'), async (req: AuthenticatedRequest, res) => {`
);

fs.writeFileSync('server/routes/import.ts', content);
