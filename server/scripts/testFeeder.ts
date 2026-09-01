import { feederRepo } from '../repositories/firestore/feederRepository';

async function testFeeder() {
  const feeder = await feederRepo.findByCode('475-VH');
  console.log(feeder);
}

testFeeder().catch(console.error);
