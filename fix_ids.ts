import fs from 'fs';

function replaceParseIntId(file: string) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Replace parseInt(substation_id)
  content = content.replace(/parseInt\(substation_id\)/g, "(isNaN(Number(substation_id)) ? substation_id : Number(substation_id))");
  content = content.replace(/parseInt\(feeder_id\)/g, "(isNaN(Number(feeder_id)) ? feeder_id : Number(feeder_id))");
  
  // Handle optional parsing like `substation_id ? parseInt(substation_id) : ...`
  // Actually, the above global replace will catch it and become `substation_id ? (isNaN(...) ...) : ...`
  
  fs.writeFileSync(file, content);
}

replaceParseIntId('server/routes/devices.ts');
replaceParseIntId('server/routes/feeders.ts');

console.log("Done fixing devices and feeders");
