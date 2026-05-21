import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { randomId } from '../lib/crypto.js';
import { asyncHandler, sendError } from '../lib/http.js';
import { store } from '../lib/store.js';

export const commandsRouter = Router();

commandsRouter.use(requireAuth);

commandsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(store.data.commands);
}));

commandsRouter.post('/', asyncHandler(async (req, res) => {
  if (!req.body?.title?.trim() || !req.body?.command?.trim()) {
    return sendError(res, 400, 'Title and command are required');
  }
  const now = new Date().toISOString();
  const command = {
    id: randomId(8),
    title: req.body.title.trim(),
    command: req.body.command,
    connectionId: req.body.connectionId || '',
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    createdAt: now,
    updatedAt: now
  };
  store.data.commands.push(command);
  store.save();
  res.status(201).json(command);
}));

commandsRouter.put('/:id', asyncHandler(async (req, res) => {
  const command = store.data.commands.find((item) => item.id === req.params.id);
  if (!command) return sendError(res, 404, 'Command not found');
  command.title = req.body.title?.trim() || command.title;
  command.command = Object.hasOwn(req.body, 'command') ? req.body.command : command.command;
  command.connectionId = Object.hasOwn(req.body, 'connectionId') ? req.body.connectionId : command.connectionId;
  command.tags = Array.isArray(req.body.tags) ? req.body.tags : command.tags;
  command.updatedAt = new Date().toISOString();
  store.save();
  res.json(command);
}));

commandsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const before = store.data.commands.length;
  store.data.commands = store.data.commands.filter((item) => item.id !== req.params.id);
  if (store.data.commands.length === before) return sendError(res, 404, 'Command not found');
  store.save();
  res.json({ ok: true });
}));
