import { deviceRepo } from './server/repositories/firestore/deviceRepository.js';
(async () => {
  try {
    const res = await deviceRepo.list();
    console.log("SUCCESS length:", res.length);
  } catch(e) {
    console.error("ERROR:");
    console.error(e);
  }
})();
