import type { UserDoc } from '../models/User.js';
import type { UserPublic, DailyEntryKind, DailyTag } from '@momoya/shared';
import { decryptProfileField } from './fieldCrypto.js';

function normalizeDefaultView(v: unknown): DailyEntryKind {
  return v === 'report' ? 'report' : 'daily';
}

function normalizeReportTags(raw: unknown): DailyTag[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      if (!t || typeof t !== 'object') return null;
      const id = String((t as { id?: unknown }).id ?? '');
      const label = String((t as { label?: unknown }).label ?? '');
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((t): t is DailyTag => t !== null);
}

export function toUserPublic(user: UserDoc): UserPublic {
  return {
    id: String(user._id),
    username: user.username,
    profile: {
      displayName: decryptProfileField(user.profile?.displayName ?? ''),
      bio: decryptProfileField(user.profile?.bio ?? ''),
      avatarUrl: user.profile?.avatarUrl ?? '',
      dailyDefaultView: normalizeDefaultView(user.profile?.dailyDefaultView),
      reportTags: normalizeReportTags(user.profile?.reportTags),
    },
  };
}
