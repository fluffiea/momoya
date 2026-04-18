import { Router } from 'express';
import type { HomePartnerCard, HomePartnersResponse } from '@momoya/shared';
import { User } from '../models/User.js';
import { toUserPublic } from '../lib/userPublic.js';

export const homeRouter = Router();

const SLOT_ORDER = ['jiangjiang', 'mengmeng'] as const;

function fallbackDisplayName(username: string): string {
  return username === 'jiangjiang' ? '江江' : '萌萌';
}

homeRouter.get('/home/partners', async (_req, res) => {
  const docs = await User.find({ username: { $in: [...SLOT_ORDER] } }).exec();
  const byUsername = new Map(docs.map((u) => [u.username, u]));

  const toCard = (username: (typeof SLOT_ORDER)[number]): HomePartnerCard => {
    const doc = byUsername.get(username);
    if (!doc) {
      return {
        username,
        displayName: fallbackDisplayName(username),
        avatarUrl: '',
      };
    }
    const pub = toUserPublic(doc);
    const dn = pub.profile.displayName.trim();
    return {
      username,
      displayName: dn || fallbackDisplayName(username),
      avatarUrl: pub.profile.avatarUrl ?? '',
    };
  };

  const partners: [HomePartnerCard, HomePartnerCard] = [toCard('jiangjiang'), toCard('mengmeng')];
  const body: HomePartnersResponse = { partners };
  res.json(body);
});
