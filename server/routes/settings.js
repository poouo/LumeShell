import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler } from '../lib/http.js';
import { store } from '../lib/store.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(store.data.settings);
}));

settingsRouter.put('/', asyncHandler(async (req, res) => {
  const next = req.body || {};
  store.data.settings = {
    ...store.data.settings,
    tokenTtlHours: Math.max(1, Math.min(24 * 30, Number(next.tokenTtlHours || store.data.settings.tokenTtlHours || 24))),
    githubRepo: String(next.githubRepo ?? store.data.settings.githubRepo ?? '').trim(),
    publicUrl: String(next.publicUrl ?? store.data.settings.publicUrl ?? '').trim(),
    theme: next.theme === 'light' ? 'light' : 'dark'
  };
  store.save();
  res.json(store.data.settings);
}));
