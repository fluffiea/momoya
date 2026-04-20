import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import type {
  DailyEntry as DailyEntryDto,
  DailyComment as DailyCommentDto,
  DailyEntriesPage,
  DailyEntryKind,
  DailyAck,
  ReportReview as ReportReviewDto,
} from '@momoya/shared';
import type { HydratedDocument } from 'mongoose';
import { DailyEntryModel } from '../models/DailyEntry.js';
import { DailyCommentModel } from '../models/DailyComment.js';
import { ReportReviewModel } from '../models/ReportReview.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { DAILY_IMAGES_DIR } from '../paths.js';
import {
  DAILY_IMAGES_STATIC_PREFIX,
  isSafeDailyImageFilename,
  tryDeleteDailyImageFile,
} from '../lib/dailyImageFiles.js';
import { broadcastDailyEvent, subscribeDailyEvents } from '../lib/dailyEvents.js';

export const dailyRouter = Router();

/** SSE `daily` 事件可选带的正文前缀，减轻客户端对「仅元数据」的焦虑（仍应拉全量详情合并） */
const DAILY_SSE_BODY_PREVIEW_MAX = 120;
function bodyPreviewForSse(body: string | undefined): string | undefined {
  if (body === undefined || body === null) return undefined;
  const t = String(body).trim();
  if (!t) return undefined;
  return t.length > DAILY_SSE_BODY_PREVIEW_MAX ? t.slice(0, DAILY_SSE_BODY_PREVIEW_MAX) : t;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LeanDaily = {
  _id: { toString(): string };
  at: Date;
  body: string;
  tags: { id: string; label: string }[];
  images: string[];
  createdByUsername?: string | null;
  updatedByUsername?: string | null;
  kind?: DailyEntryKind | null;
  acks?: { username: string; at: Date }[];
};

type LeanComment = {
  _id: { toString(): string };
  entryId: string;
  parentId: string | null;
  body: string;
  username: string;
  createdAt: Date;
};

type LeanReview = {
  _id: { toString(): string };
  entryId: string;
  username: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Serializers ──────────────────────────────────────────────────────────────

function normalizeKind(v: unknown): DailyEntryKind {
  return v === 'report' ? 'report' : 'daily';
}

function serializeAcks(raw: { username: string; at: Date }[] | undefined): DailyAck[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => ({ username: a.username, at: new Date(a.at).toISOString() }));
}

function serializeLean(d: LeanDaily): DailyEntryDto {
  return {
    id: String(d._id),
    at: new Date(d.at).toISOString(),
    body: d.body,
    tags: (d.tags ?? []).map((t) => ({ id: t.id, label: t.label })),
    images: d.images ?? [],
    createdByUsername: d.createdByUsername ?? undefined,
    updatedByUsername: d.updatedByUsername ?? undefined,
    kind: normalizeKind(d.kind),
    acks: serializeAcks(d.acks),
  };
}

function serializeComment(c: LeanComment): DailyCommentDto {
  return {
    id: String(c._id),
    entryId: c.entryId,
    parentId: c.parentId ?? undefined,
    body: c.body,
    username: c.username,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

function serializeReview(r: LeanReview): ReportReviewDto {
  return {
    id: String(r._id),
    entryId: r.entryId,
    username: r.username,
    body: r.body,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
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

// ─── Multer for daily images ───────────────────────────────────────────────────

const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const dailyImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, DAILY_IMAGES_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = mimeToExt[file.mimetype] ?? '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  // 前端会先做压缩，正常走到这里的文件 < 2MB；上限留 15MB 作为"未压缩原图"兜底
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (mimeToExt[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPEG、PNG、WebP'));
    }
  },
});

// ─── Public routes ─────────────────────────────────────────────────────────────

// ─── Cursor pagination helpers ────────────────────────────────────────────────
// 游标格式： base64url("<atISO>|<id>")
// 排序基准：at desc, _id desc（_id 作 tie-breaker 防止同一 at 漏数据/重复）

const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 50;

function encodeCursor(at: Date, id: string): string {
  const raw = `${at.toISOString()}|${id}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { at: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.lastIndexOf('|');
    if (sep < 0) return null;
    const atStr = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    const at = new Date(atStr);
    if (Number.isNaN(at.getTime()) || !id) return null;
    return { at, id };
  } catch {
    return null;
  }
}

function parseKindQuery(v: unknown): DailyEntryKind {
  return v === 'report' ? 'report' : 'daily';
}

dailyRouter.get('/entries', async (req, res) => {
  const rawLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_PAGE_LIMIT)
    : DEFAULT_PAGE_LIMIT;

  const kind = parseKindQuery(req.query.kind);

  const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length > 0
    ? decodeCursor(req.query.cursor)
    : null;

  // 多取 1 条用于判断是否还有下一页
  // kind=daily 时兼容旧文档（无 kind 字段）：$in ['daily', null, undefined]
  const kindFilter =
    kind === 'report'
      ? { kind: 'report' }
      : { $or: [{ kind: 'daily' }, { kind: { $exists: false } }, { kind: null }] };

  const filter: Record<string, unknown> = { ...kindFilter };
  if (cursor) {
    // (at < cursor.at) 或 (at == cursor.at 且 _id < cursor.id)
    const cursorCond = [
      { at: { $lt: cursor.at } },
      { at: cursor.at, _id: { $lt: cursor.id } },
    ];
    // 需要与 kind filter 复合（已经有 $or 时，改用 $and 包两层）
    if (Array.isArray((filter as { $or?: unknown[] }).$or)) {
      const existingOr = (filter as { $or: unknown[] }).$or;
      delete (filter as { $or?: unknown[] }).$or;
      filter.$and = [{ $or: existingOr }, { $or: cursorCond }];
    } else {
      filter.$or = cursorCond;
    }
  }

  const docs = await DailyEntryModel.find(filter)
    .sort({ at: -1, _id: -1 })
    .limit(limit + 1)
    .lean<LeanDaily[]>();

  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  const last = pageDocs[pageDocs.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(new Date(last.at), String(last._id)) : null;

  // 列表里对 report 条目做一次批量 review 查询，避免前端拉到列表后还需要逐条拉详情
  const entries = pageDocs.map(serializeLean);
  if (kind === 'report' && entries.length > 0) {
    const entryIds = entries.map((e) => e.id);
    const reviews = await ReportReviewModel.find({ entryId: { $in: entryIds } })
      .lean<LeanReview[]>();
    // 每条 entry 最多一条 review（由 receiver 写入）；如有多条（理论上只会有一条）以最新为准
    const byEntry = new Map<string, LeanReview>();
    for (const r of reviews) {
      const existing = byEntry.get(r.entryId);
      if (!existing || new Date(r.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        byEntry.set(r.entryId, r);
      }
    }
    for (const entry of entries) {
      const r = byEntry.get(entry.id);
      entry.review = r ? serializeReview(r) : null;
    }
  }

  const payload: DailyEntriesPage = {
    entries,
    nextCursor,
  };
  res.json(payload);
});

/** 公开：获取某条目下的评论列表 */
dailyRouter.get('/entries/:id/comments', async (req, res) => {
  const comments = await DailyCommentModel.find({ entryId: req.params.id })
    .sort({ createdAt: 1 })
    .lean<LeanComment[]>();
  res.json({ comments: comments.map(serializeComment) });
});

// ─── Auth guard ────────────────────────────────────────────────────────────────

dailyRouter.use(requireAuth);

// ─── SSE: 实时事件流 ──────────────────────────────────────────────────────────

dailyRouter.get('/events', (req, res) => {
  const u = res.locals.authUser;
  if (!u) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  subscribeDailyEvents(req, res, u.username);
});

// ─── Entry CRUD ────────────────────────────────────────────────────────────────

dailyRouter.get('/entries/:id', async (req, res) => {
  const doc = await DailyEntryModel.findById(req.params.id).lean<LeanDaily | null>();
  if (!doc) {
    res.status(404).json({ error: '不存在' });
    return;
  }
  const payload = serializeLean(doc);
  if (payload.kind === 'report') {
    const review = await ReportReviewModel.findOne({ entryId: req.params.id }).lean<LeanReview | null>();
    payload.review = review ? serializeReview(review) : null;
  }
  res.json({ entry: payload });
});

dailyRouter.post('/entries', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const { at, body, tags, kind: rawKind } = req.body ?? {};
  if (!at) {
    res.status(400).json({ error: '缺少 at' });
    return;
  }
  const atDate = new Date(String(at));
  if (Number.isNaN(atDate.getTime())) {
    res.status(400).json({ error: '时间格式无效' });
    return;
  }
  const kind: DailyEntryKind = rawKind === 'report' ? 'report' : 'daily';
  const bodyStr = body === undefined || body === null ? '' : String(body);
  const tagList = Array.isArray(tags) ? tags : [];
  const normalizedTags = tagList
    .map((t: { id?: string; label?: string }) => ({
      id: String(t?.id ?? randomUUID()),
      label: String(t?.label ?? '').slice(0, 80),
    }))
    .filter((t) => t.label.length > 0);

  // 报备：tags 必选（≥1），body 允许为空（图片会随后走独立上传接口补齐）
  if (kind === 'report' && normalizedTags.length === 0) {
    res.status(400).json({ error: '报备至少需要一个标签' });
    return;
  }
  // 日常：保持历史行为，body 必填
  if (kind === 'daily' && bodyStr.trim().length === 0) {
    res.status(400).json({ error: '缺少 body' });
    return;
  }

  const doc = await DailyEntryModel.create({
    at: atDate,
    body: bodyStr.slice(0, 20000),
    tags: normalizedTags,
    images: [],
    createdByUsername: user.username,
    updatedByUsername: user.username,
    kind,
    acks: [],
  });
  broadcastDailyEvent({
    type: 'entry.created',
    entryId: String(doc._id),
    by: user.username,
    bodyPreview: bodyPreviewForSse(doc.body),
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
  const { at, body, tags, images } = req.body ?? {};
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
    if (doc.kind === 'report' && normalizedTags.length === 0) {
      res.status(400).json({ error: '报备至少需要一个标签' });
      return;
    }
    doc.set('tags', normalizedTags);
  }
  // images：仅允许"对当前 entry 现有图片的重排"，不允许通过此接口新增/删除图片文件
  // （图片新增走 POST /:id/images，单张删除走 DELETE /:id/images/:idx）
  if (images !== undefined) {
    if (!Array.isArray(images) || !images.every((u): u is string => typeof u === 'string')) {
      res.status(400).json({ error: '请提供 images 字符串数组' });
      return;
    }
    const currentImages: string[] = (doc.get('images') as string[] | undefined) ?? [];
    if (images.length !== currentImages.length) {
      res.status(400).json({ error: '图片数量与当前不一致' });
      return;
    }
    const currentSet = new Set(currentImages);
    for (const u of images) {
      if (!currentSet.has(u)) {
        res.status(400).json({ error: '存在不属于该日常的图片 URL' });
        return;
      }
    }
    if (new Set(images).size !== images.length) {
      res.status(400).json({ error: '图片不能重复' });
      return;
    }
    doc.set('images', images);
  }

  // 报备：整体状态校验——不允许出现"既没正文也没图片"的空壳条目
  if (doc.kind === 'report') {
    const finalImages = (doc.get('images') as string[] | undefined) ?? [];
    if (doc.body.trim().length === 0 && finalImages.length === 0) {
      res.status(400).json({ error: '报备的文案和图片至少保留一项' });
      return;
    }
  }

  doc.updatedByUsername = user.username;
  await doc.save();
  const leanAfter = doc.toObject() as LeanDaily;
  broadcastDailyEvent({
    type: 'entry.updated',
    entryId: String(doc._id),
    by: user.username,
    bodyPreview: bodyPreviewForSse(leanAfter.body),
  });
  res.json({ entry: serializeLean(leanAfter) });
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
  // 清理关联图片文件
  const images: string[] = (doc.get('images') as string[] | undefined) ?? [];
  for (const url of images) {
    tryDeleteDailyImageFile(url);
  }
  // 删除关联评论 + 报备评价
  await DailyCommentModel.deleteMany({ entryId: String(doc._id) });
  await ReportReviewModel.deleteMany({ entryId: String(doc._id) });
  const removedId = String(doc._id);
  await doc.deleteOne();
  broadcastDailyEvent({
    type: 'entry.deleted',
    entryId: removedId,
    by: user.username,
  });
  res.status(204).send();
});

// ─── Image upload / delete ─────────────────────────────────────────────────────

dailyRouter.post(
  '/entries/:id/images',
  (req, res, next) => {
    dailyImageUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: string }).code)
            : '';
        let msg = err instanceof Error ? err.message : '上传失败';
        if (code === 'LIMIT_FILE_SIZE') {
          msg = '图片过大，请换一张更小的图片';
        }
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: '请选择图片文件' });
      return;
    }
    const user = await User.findById(req.session.userId);
    if (!user) {
      await unlink(req.file.path).catch(() => {});
      res.status(401).json({ error: '未登录' });
      return;
    }
    const doc = await DailyEntryModel.findById(req.params.id);
    if (!doc) {
      await unlink(req.file.path).catch(() => {});
      res.status(404).json({ error: '日常不存在' });
      return;
    }
    const owner = entryOwnerUsername(doc);
    if (!owner || owner !== user.username) {
      await unlink(req.file.path).catch(() => {});
      res.status(403).json({ error: '只能为自己的日常上传图片' });
      return;
    }
    const currentImages: string[] = (doc.get('images') as string[] | undefined) ?? [];
    if (currentImages.length >= 9) {
      await unlink(req.file.path).catch(() => {});
      res.status(400).json({ error: '最多上传 9 张图片' });
      return;
    }
    const name = path.basename(req.file.filename);
    if (!isSafeDailyImageFilename(name)) {
      await unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: '无效文件名' });
      return;
    }
    const imageUrl = `${DAILY_IMAGES_STATIC_PREFIX}${name}`;
    currentImages.push(imageUrl);
    doc.set('images', currentImages);
    await doc.save();
    const leanImg = doc.toObject() as LeanDaily;
    broadcastDailyEvent({
      type: 'entry.updated',
      entryId: String(doc._id),
      by: user.username,
      bodyPreview: bodyPreviewForSse(leanImg.body),
    });
    res.json({ entry: serializeLean(leanImg) });
  },
);

dailyRouter.delete('/entries/:id/images/:idx', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const doc = await DailyEntryModel.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: '日常不存在' });
    return;
  }
  const owner = entryOwnerUsername(doc);
  if (!owner || owner !== user.username) {
    res.status(403).json({ error: '只能删除自己日常的图片' });
    return;
  }
  const idx = parseInt(req.params.idx, 10);
  const currentImages: string[] = [...((doc.get('images') as string[] | undefined) ?? [])];
  if (Number.isNaN(idx) || idx < 0 || idx >= currentImages.length) {
    res.status(400).json({ error: '图片下标无效' });
    return;
  }
  const removed = currentImages.splice(idx, 1)[0];
  doc.set('images', currentImages);
  await doc.save();
  tryDeleteDailyImageFile(removed);
  const leanDelImg = doc.toObject() as LeanDaily;
  broadcastDailyEvent({
    type: 'entry.updated',
    entryId: String(doc._id),
    by: user.username,
    bodyPreview: bodyPreviewForSse(leanDelImg.body),
  });
  res.json({ entry: serializeLean(leanDelImg) });
});

// ─── Comments ─────────────────────────────────────────────────────────────────

dailyRouter.post('/entries/:id/comments', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const entry = await DailyEntryModel.findById(req.params.id).lean();
  if (!entry) {
    res.status(404).json({ error: '日常不存在' });
    return;
  }
  const body = String(req.body?.body ?? '').trim().slice(0, 1000);
  if (!body) {
    res.status(400).json({ error: '评论内容不能为空' });
    return;
  }
  // 可选：回复某条评论
  const rawParentId = req.body?.parentId;
  let parentId: string | null = null;
  if (rawParentId && typeof rawParentId === 'string') {
    const parent = await DailyCommentModel.findById(rawParentId).lean();
    if (!parent || String((parent as { entryId: string }).entryId) !== req.params.id) {
      res.status(400).json({ error: '被回复的评论不存在' });
      return;
    }
    // 只允许回复顶级评论（扁平两层）
    parentId = (parent as { parentId?: string | null }).parentId
      ? String((parent as { parentId: string }).parentId)
      : rawParentId;
  }
  const comment = await DailyCommentModel.create({
    entryId: req.params.id,
    parentId,
    body,
    username: user.username,
  });
  broadcastDailyEvent({
    type: 'comment.created',
    entryId: req.params.id,
    commentId: String(comment._id),
    parentId,
    by: user.username,
  });
  res.status(201).json({ comment: serializeComment(comment.toObject() as LeanComment) });
});

dailyRouter.patch('/entries/:id/comments/:commentId', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const comment = await DailyCommentModel.findById(req.params.commentId);
  if (!comment) {
    res.status(404).json({ error: '评论不存在' });
    return;
  }
  if (comment.username !== user.username) {
    res.status(403).json({ error: '只能编辑自己的评论' });
    return;
  }
  const replyCount = await DailyCommentModel.countDocuments({ parentId: req.params.commentId });
  if (replyCount > 0) {
    res.status(403).json({ error: '已有回复的评论不能编辑' });
    return;
  }
  const body = String(req.body?.body ?? '').trim().slice(0, 1000);
  if (!body) {
    res.status(400).json({ error: '评论内容不能为空' });
    return;
  }
  comment.set('body', body);
  await comment.save();
  broadcastDailyEvent({
    type: 'comment.updated',
    entryId: String(comment.get('entryId')),
    commentId: String(comment._id),
    by: user.username,
  });
  res.json({ comment: serializeComment(comment.toObject() as LeanComment) });
});

dailyRouter.delete('/entries/:id/comments/:commentId', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const comment = await DailyCommentModel.findById(req.params.commentId);
  if (!comment) {
    res.status(404).json({ error: '评论不存在' });
    return;
  }
  if (comment.username !== user.username) {
    res.status(403).json({ error: '只能删除自己的评论' });
    return;
  }
  // 删除父评论时同步删除其所有回复
  await DailyCommentModel.deleteMany({ parentId: req.params.commentId });
  const removedEntryId = String(comment.get('entryId'));
  const removedCommentId = String(comment._id);
  await comment.deleteOne();
  broadcastDailyEvent({
    type: 'comment.deleted',
    entryId: removedEntryId,
    commentId: removedCommentId,
    by: user.username,
  });
  res.status(204).send();
});

// ─── Report: ack & review ─────────────────────────────────────────────────────

/**
 * 点击「已阅」：仅报备；仅创建者的"对方"可点击；一人一次性追加，不可撤销。
 * 幂等：同一用户多次点击只保留第一次的时间。
 */
dailyRouter.post('/entries/:id/ack', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const doc = await DailyEntryModel.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: '报备不存在' });
    return;
  }
  const kind = normalizeKind(doc.get('kind'));
  if (kind !== 'report') {
    res.status(400).json({ error: '只有报备支持已阅' });
    return;
  }
  const owner = entryOwnerUsername(doc);
  if (!owner || owner === user.username) {
    res.status(403).json({ error: '不能对自己的报备点击已阅' });
    return;
  }
  const existing: { username: string; at: Date }[] =
    (doc.get('acks') as { username: string; at: Date }[] | undefined) ?? [];
  if (existing.some((a) => a.username === user.username)) {
    res.json({ entry: serializeLean(doc.toObject() as LeanDaily) });
    return;
  }
  existing.push({ username: user.username, at: new Date() });
  doc.set('acks', existing);
  await doc.save();
  broadcastDailyEvent({
    type: 'entry.acked',
    entryId: String(doc._id),
    by: user.username,
  });
  res.json({ entry: serializeLean(doc.toObject() as LeanDaily) });
});

/**
 * 写入/覆盖评价（upsert）：仅报备；仅"对方"可写；每人一条。
 */
dailyRouter.put('/entries/:id/review', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const doc = await DailyEntryModel.findById(req.params.id).lean<LeanDaily | null>();
  if (!doc) {
    res.status(404).json({ error: '报备不存在' });
    return;
  }
  if (normalizeKind(doc.kind) !== 'report') {
    res.status(400).json({ error: '只有报备支持评价' });
    return;
  }
  const owner = entryOwnerUsername(doc);
  if (!owner || owner === user.username) {
    res.status(403).json({ error: '不能评价自己的报备' });
    return;
  }
  const body = String(req.body?.body ?? '').trim().slice(0, 1000);
  if (!body) {
    res.status(400).json({ error: '评价内容不能为空' });
    return;
  }
  const updated = await ReportReviewModel.findOneAndUpdate(
    { entryId: req.params.id, username: user.username },
    { $set: { body } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean<LeanReview | null>();
  if (!updated) {
    res.status(500).json({ error: '保存失败' });
    return;
  }
  broadcastDailyEvent({
    type: 'review.upserted',
    entryId: req.params.id,
    by: user.username,
  });
  res.json({ review: serializeReview(updated) });
});

/**
 * 撤回评价（可选）：仅评价作者可删。
 */
dailyRouter.delete('/entries/:id/review', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const removed = await ReportReviewModel.findOneAndDelete({
    entryId: req.params.id,
    username: user.username,
  });
  if (!removed) {
    res.status(404).json({ error: '尚未评价' });
    return;
  }
  broadcastDailyEvent({
    type: 'review.deleted',
    entryId: req.params.id,
    by: user.username,
  });
  res.status(204).send();
});
