import type { UserDoc } from '../models/User.js';
import type { UserPublic } from '@momoya/shared';
import { decryptProfileField } from './fieldCrypto.js';

export function toUserPublic(user: UserDoc): UserPublic {
  return {
    id: String(user._id),
    username: user.username,
    profile: {
      displayName: decryptProfileField(user.profile?.displayName ?? ''),
      bio: decryptProfileField(user.profile?.bio ?? ''),
      avatarUrl: user.profile?.avatarUrl ?? '',
    },
  };
}
