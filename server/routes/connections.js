import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, sendError } from '../lib/http.js';
import { deleteConnection, getConnection, listConnections, publicConnection, upsertConnection } from '../lib/connections.js';

export const connectionsRouter = Router();

connectionsRouter.use(requireAuth);

function validateConnection(input) {
  if (!input.host?.trim()) return 'Host is required';
  if (!input.username?.trim()) return 'Username is required';
  if (!Number(input.port || 22)) return 'Port must be a number';
  return '';
}

connectionsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(listConnections());
}));

connectionsRouter.post('/', asyncHandler(async (req, res) => {
  const error = validateConnection(req.body || {});
  if (error) return sendError(res, 400, error);
  res.status(201).json(upsertConnection(req.body));
}));

connectionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const connection = getConnection(req.params.id);
  if (!connection) return sendError(res, 404, 'Connection not found');
  res.json(publicConnection(connection));
}));

connectionsRouter.put('/:id', asyncHandler(async (req, res) => {
  const connection = getConnection(req.params.id);
  if (!connection) return sendError(res, 404, 'Connection not found');
  const error = validateConnection(req.body || {});
  if (error) return sendError(res, 400, error);
  res.json(upsertConnection(req.body, req.params.id));
}));

connectionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (!deleteConnection(req.params.id)) return sendError(res, 404, 'Connection not found');
  res.json({ ok: true });
}));
