import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';
import { deviceRepo } from '../repositories/firestore/deviceRepository';

async function auditLinks() {
  console.log('--- Starting Link Audit ---');
  
  const substations = await substationRepo.list();
  const feeders = await feederRepo.list();
  const devices = await deviceRepo.list();
  
  const substationIds = new Set(substations.map(s => String(s.id)));
  const feederIds = new Set(feeders.map(f => String(f.id)));
  
  console.log(`Found ${substations.length} substations, ${feeders.length} feeders, ${devices.length} devices.`);
  
  // Check feeders
  for (const feeder of feeders) {
    if (!substationIds.has(String(feeder.substation_id))) {
      console.error(`Orphan Feeder: ${feeder.name} (id: ${feeder.id}) points to non-existent substation id: ${feeder.substation_id}`);
    }
  }
  
  // Check devices
  for (const device of devices) {
    if (!substationIds.has(String(device.substation_id))) {
      console.error(`Orphan Device (Substation): ${device.name} (id: ${device.id}) points to non-existent substation id: ${device.substation_id}`);
    }
    if (!feederIds.has(String(device.feeder_id))) {
      console.error(`Orphan Device (Feeder): ${device.name} (id: ${device.id}) points to non-existent feeder id: ${device.feeder_id}`);
    }
  }
  
  console.log('--- Audit Finished ---');
}

auditLinks().catch(console.error);
