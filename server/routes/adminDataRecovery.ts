import express from 'express';
const router = express.Router();
router.use((req, res) => {
  res.status(404).json({ error: 'Endpoint inactive after final Firestore cutover' });
});
export default router;
