import { Router } from 'express';
import { changePassword, clearAuthCookie, login, requireAuth, setAuthCookie } from '../lib/auth.js';
import { asyncHandler, sendError } from '../lib/http.js';
import { store } from '../lib/store.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const token = login(req.body?.password || '');
  if (!token) return sendError(res, 401, 'Invalid password');
  setAuthCookie(res, token);
  res.json({
    ok: true,
    tokenTtlHours: store.data.settings.tokenTtlHours
  });
}));

authRouter.post('/logout', requireAuth, asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({
    user: {
      role: req.user.role,
      exp: req.user.exp
    },
    settings: {
      tokenTtlHours: store.data.settings.tokenTtlHours,
      theme: store.data.settings.theme || 'dark',
      language: store.data.settings.language || 'zh-CN'
    }
  });
}));

authRouter.put('/password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, nextPassword } = req.body || {};
  if (!nextPassword || nextPassword.length < 8) {
    return sendError(res, 400, 'New password must contain at least 8 characters');
  }
  if (!changePassword(currentPassword || '', nextPassword)) {
    return sendError(res, 400, 'Current password is incorrect');
  }
  clearAuthCookie(res);
  res.json({ ok: true });
}));
