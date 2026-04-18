import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { DailyEntry as DailyEntryDto } from '@momoya/shared';
import type { HydratedDocument } from 'mongoose';
import { DailyEntryModel } from '../models/DailyEntry.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const dailyRouter = Router();

type LeanDaily = {
  _id: { toString(): string };
  at: Date;
  body: string;
  tags: { id: string; label: string }[];
  createdByUsername?: string | null;
  updatedByUsername?: string | null;
};

function serializeLean(d: LeanDaily): DailyEntryDto {
  return {
    id: String(d._id),
    at: new Date(d.at).toISOString(),
    body: d.body,
    tags: (d.tags ?? []).map((t) => ({ id: t.id, label: t.label })),
    createdByUsername: d.createdByUsername ?? undefined,
    updatedByUsername: d.updatedByUsername ?? undefined,
  };
}

/** 权限：创建者优先，兼容仅有 updatedByUsername 的旧文档 */
function entryOwnerUsername(doc: {
  createdByUsername?: string | null;
  updatedByUsername?: string | null;
}): string | undefined {
  const raw = doc.createdByUsername ?? doc.updatedByUsername;
  if (!raw || typeof raw !== 'string') return undefined;
  const s = raw.trim();
  return s.length > 0 ? s : undefined;
}

dailyRouter.get('/entries', async (_req, res) => {
  const docs = await DailyEntryModel.find().sort({ at: -1 }).lean<LeanDaily[]>();
  res.json({ entries: docs.map(serializeLean) });
});

dailyRouter.use(requireAuth);

dailyRouter.get('/entries/:id', async (req, res) => {
  const doc = await DailyEntryModel.findById(req.params.id).lean<LeanDaily | null>();
  if (!doc) {
    res.status(404).json({ error: '不存在' });
    return;
  }
  res.json({ entry: serializeLean(doc) });
});

dailyRouter.post('/entries', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const { at, body, tags } = req.body ?? {};
  if (!at || !body) {
    res.status(400).json({ error: '缺少 at 或 body' });
    return;
  }
  const atDate = new Date(String(at));
  if (Number.isNaN(atDate.getTime())) {
    res.status(400).json({ error: '时间格式无效' });
    return;
  }
  const tagList = Array.isArray(tags) ? tags : [];
  const normalizedTags = tagList
    .map((t: { id?: string; label?: string }) => ({
      id: String(t?.id ?? randomUUID()),
      label: String(t?.label ?? '').slice(0, 80),
    }))
    .filter((t) => t.label.length > 0);

  const doc = await DailyEntryModel.create({
    at: atDate,
    body: String(body).slice(0, 20000),
    tags: normalizedTags,
    createdByUsername: user.username,
    updatedByUsername: user.username,
  });
  res.status(201).json({
    entry: serializeLean(doc.toObject() as LeanDaily),
  });
});

dailyRouter.patch('/entries/:id', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const doc: HydratedDocument<InstanceType<typeof DailyEntryModel>> | null =
    await DailyEntryModel.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: '不存在' });
    return;
  }
  const owner = entryOwnerUsername(doc);
  if (!owner || owner !== user.username) {
    res.status(403).json({ error: '只能编辑自己创建的日常' });
    return;
  }
  const { at, body, tags } = req.body ?? {};
  if (at !== undefined) {
    const atDate = new Date(String(at));
    if (Number.isNaN(atDate.getTime())) {
      res.status(400).json({ error: '时间格式无效' });
      return;
    }
    doc.at = atDate;
  }
  if (body !== undefined) {
    doc.body = String(body).slice(0, 20000);
  }
  if (tags !== undefined) {
    const tagList = Array.isArray(tags) ? tags : [];
    const normalizedTags = tagList
      .map((t: { id?: string; label?: string }) => ({
        id: String(t?.id ?? randomUUID()),
        label: String(t?.label ?? '').slice(0, 80),
      }))
      .filter((t) => t.label.length > 0);
    doc.set('tags', normalizedTags);
  }
  doc.updatedByUsername = user.username;
  await doc.save();
  res.json({ entry: serializeLean(doc.toObject() as LeanDaily) });
});

dailyRouter.delete('/entries/:id', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const doc = await DailyEntryModel.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: '不存在' });
    return;
  }
  const owner = entryOwnerUsername(doc);
  if (!owner || owner !== user.username) {
    res.status(403).json({ error: '只能删除自己创建的日常' });
    return;
  }
  await doc.deleteOne();
  res.status(204).send();
});
