import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler } from '../lib/http.js';
import { store } from '../lib/store.js';

export const backupRouter = Router();

backupRouter.use(requireAuth);

backupRouter.get('/export', asyncHandler(async (_req, res) => {
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d+Z$/, 'Z');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="lumeshell-backup-${stamp}.json"`);
  res.json(store.exportBackup());
}));

backupRouter.post('/import', asyncHandler(async (req, res) => {
  store.importBackup(req.body);
  res.json({ ok: true });
}));
