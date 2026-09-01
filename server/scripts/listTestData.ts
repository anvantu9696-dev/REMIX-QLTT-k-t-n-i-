import { substationRepo } from '../repositories/firestore/substationRepository';
import { feederRepo } from '../repositories/firestore/feederRepository';

async function listData() {
  const subs = await substationRepo.list();
  console.log('Substations:', subs.slice(0, 3).map(s => s.substation_code));
  const feeders = await feederRepo.list();
  console.log('Feeders:', feeders.slice(0, 3).map(f => f.feeder_code));
}

listData().catch(console.error);
