const fs = require('fs');

let code = fs.readFileSync('server/routes/devices.ts', 'utf8');
code = code.replace(/google_maps_url: req\.body\.google_maps_url_b64 \? Buffer\.from\(req\.body\.google_maps_url_b64,\s*primary_image: req\.body\.primary_image_b64 \? Buffer\.from\(req\.body\.primary_image_b64, 'base64'\)\.toString\('utf8'\) : \(req\.body\.primary_image !== undefined \? req\.body\.primary_image : \(typeof device !== 'undefined' \? device\.primary_image : undefined\)\), 'base64'\)\.toString\('utf8'\) : req\.body\.google_maps_url,/g, 
  "google_maps_url: req.body.google_maps_url_b64 ? Buffer.from(req.body.google_maps_url_b64, 'base64').toString('utf8') : req.body.google_maps_url,\n              primary_image: req.body.primary_image_b64 ? Buffer.from(req.body.primary_image_b64, 'base64').toString('utf8') : (req.body.primary_image !== undefined ? req.body.primary_image : undefined),");
  
code = code.replace(/google_maps_url: req\.body\.google_maps_url_b64 \? Buffer\.from\(req\.body\.google_maps_url_b64,\s*primary_image: req\.body\.primary_image_b64 \? Buffer\.from\(req\.body\.primary_image_b64, 'base64'\)\.toString\('utf8'\) : \(req\.body\.primary_image !== undefined \? req\.body\.primary_image : \(typeof device !== 'undefined' \? device\.primary_image : undefined\)\), 'base64'\)\.toString\('utf8'\) : \(req\.body\.google_maps_url !== undefined \? req\.body\.google_maps_url : device\.google_maps_url\),/g, 
  "google_maps_url: req.body.google_maps_url_b64 ? Buffer.from(req.body.google_maps_url_b64, 'base64').toString('utf8') : (req.body.google_maps_url !== undefined ? req.body.google_maps_url : device.google_maps_url),\n                  primary_image: req.body.primary_image_b64 ? Buffer.from(req.body.primary_image_b64, 'base64').toString('utf8') : (req.body.primary_image !== undefined ? req.body.primary_image : device.primary_image),");

fs.writeFileSync('server/routes/devices.ts', code);
