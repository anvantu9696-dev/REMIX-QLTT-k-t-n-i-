const fs = require('fs');

// Revert api.ts
let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');
apiCode = apiCode.replace(/const encodeWafFields = [\s\S]*?};\n/, '');
apiCode = apiCode.replace(/  if \(options && options\.body && typeof options\.body === 'string'\) \{\n    try \{\n      const parsed = JSON\.parse\(options\.body\);\n      const encoded = encodeWafFields\(parsed\);\n      options\.body = JSON\.stringify\(encoded\);\n    \} catch\(e\) \{\}\n  \}\n/, '');
// also remove manual btoa for google_maps_url in api.ts
apiCode = apiCode.replace(/    if \(payload\.google_maps_url\) \{\n      payload\.google_maps_url_b64 = btoa\(payload\.google_maps_url\);\n      delete payload\.google_maps_url;\n    \}\n/g, '');
apiCode = apiCode.replace(/    if \(payload\.primary_image\) \{\n      payload\.primary_image_b64 = btoa\(payload\.primary_image\);\n      delete payload\.primary_image;\n    \}\n/g, '');
fs.writeFileSync('src/lib/api.ts', apiCode);

// Revert server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(/\/\/ Auto-decode WAF protected fields[\s\S]*?next\(\);\n\}\);\n/, '');
fs.writeFileSync('server.ts', serverCode);

// Revert devices.ts (if any b64 checks remain)
let devicesCode = fs.readFileSync('server/routes/devices.ts', 'utf8');
devicesCode = devicesCode.replace(/req\.body\.google_maps_url_b64 \? Buffer\.from\(req\.body\.google_maps_url_b64, 'base64'\)\.toString\('utf8'\) : /g, '');
devicesCode = devicesCode.replace(/req\.body\.primary_image_b64 \? Buffer\.from\(req\.body\.primary_image_b64, 'base64'\)\.toString\('utf8'\) : /g, '');
fs.writeFileSync('server/routes/devices.ts', devicesCode);

console.log("Reverted WAF base64 hacks.");
