const fs = require('fs');
let code = fs.readFileSync('src/types/index.ts', 'utf8');
code = code.replace(/export interface Feeder \{/g, 'export interface Feeder {\n  version?: number;');
code = code.replace(/export interface Substation \{/g, 'export interface Substation {\n  version?: number;');
fs.writeFileSync('src/types/index.ts', code);
