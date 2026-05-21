import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { requireAuth } from '../lib/auth.js';
import { config } from '../lib/config.js';
import { deleteRemote, listRemote, mkdirRemote, renameRemote, streamDownload, uploadRemote } from '../lib/sftp.js';
import { asyncHandler } from '../lib/http.js';
import { store } from '../lib/store.js';

const upload = multer({
  dest: path.join(config.dataDir, 'upload-tmp'),
  preservePath: true,
  limits: { fileSize: parseSize(config.uploadLimit) }
});

export const filesRouter = Router();

filesRouter.use(requireAuth);

filesRouter.get('/list', asyncHandler(async (req, res) => {
  const files = await listRemote(req.query.connectionId, req.query.path || '/');
  res.json(files);
}));

filesRouter.post('/mkdir', asyncHandler(async (req, res) => {
  res.json(await mkdirRemote(req.body.connectionId, req.body.path));
}));

filesRouter.post('/rename', asyncHandler(async (req, res) => {
  res.json(await renameRemote(req.body.connectionId, req.body.from, req.body.to));
}));

filesRouter.post('/delete', asyncHandler(async (req, res) => {
  res.json(await deleteRemote(req.body.connectionId, req.body.path));
}));

filesRouter.post('/upload', upload.array('files'), asyncHandler(async (req, res) => {
  try {
    const uploaded = await uploadRemote(req.body.connectionId, req.body.path || '/', req.files || []);
    res.json(uploaded);
  } catch (err) {
    for (const file of req.files || []) {
      try {
        await fs.rm(file.path, { force: true });
      } catch {
        // Ignore temp cleanup errors; the original upload failure is more useful.
      }
    }
    throw err;
  }
}));

filesRouter.get('/download', asyncHandler(async (req, res) => {
  await streamDownload(req.query.connectionId, req.query.path, res);
}));

function parseSize(value) {
  const match = String(value || '').trim().match(/^(\d+)(kb|mb|gb)?$/i);
  if (!match) return undefined;
  const size = Number(match[1]);
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'kb') return size * 1024;
  if (unit === 'mb') return size * 1024 * 1024;
  if (unit === 'gb') return size * 1024 * 1024 * 1024;
  return size;
}
