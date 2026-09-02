import fetch from 'node-fetch';
import { getTargetAuth } from './server/firebaseAdmin';

async function run() {
  const auth = getTargetAuth();
  const token = await auth.createCustomToken('b4eFL4exmmMDHZt9OzUz6fPbIJ02'); // This is the guest UID we created earlier
  // Wait, I can't use custom token directly in authenticateToken, because authenticateToken uses verifyIdToken.
}
run();
