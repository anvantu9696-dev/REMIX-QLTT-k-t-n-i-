import { substationRepo } from '../repositories/firestore/substationRepository';

async function testSub() {
  const sub = await substationRepo.getById('wgaEI8lKCmuF89gb0Ehe');
  console.log(sub);
}

testSub().catch(console.error);
