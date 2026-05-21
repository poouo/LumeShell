import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, sendError } from '../lib/http.js';
import { checkRemoteVersion, getUpgradeTask, readLocalRelease, startUpgradeTask } from '../lib/upgrade.js';
import { readMetrics } from '../lib/metrics.js';

export const systemRouter = Router();

systemRouter.use(requireAuth);

systemRouter.get('/version', asyncHandler(async (req, res) => {
  const local = readLocalRelease();
  const remote = await checkRemoteVersion({ mode: req.query.mode === 'manual' ? 'manual' : 'auto' });
  res.json({ local, remote });
}));

systemRouter.get('/metrics', asyncHandler(async (req, res) => {
  res.json(await readMetrics(req.query.connectionId));
}));

systemRouter.post('/upgrade', asyncHandler(async (_req, res) => {
  const task = startUpgradeTask();
  res.status(202).json({ taskId: task.id });
}));

systemRouter.get('/upgrade/:id/events', asyncHandler(async (req, res) => {
  const task = getUpgradeTask(req.params.id);
  if (!task) return sendError(res, 404, 'Upgrade task not found');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  for (const event of task.events) {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const onEvent = (event) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'done') res.end();
  };

  task.emitter.on('event', onEvent);
  req.on('close', () => task.emitter.off('event', onEvent));
}));
