const fs = require('fs');

function fixFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('google_maps_url_b64')) {
    code = code.replace(/google_maps_url:(.*?),/g, 
      "google_maps_url:$1,\n              primary_image: req.body.primary_image_b64 ? Buffer.from(req.body.primary_image_b64, 'base64').toString('utf8') : (req.body.primary_image !== undefined ? req.body.primary_image : (typeof device !== 'undefined' ? device.primary_image : undefined)),");
  }
  fs.writeFileSync(file, code);
}

fixFile('server/routes/devices.ts');

