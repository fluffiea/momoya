import crypto from 'node:crypto';

const PREFIX = 'm1:';

function deriveKey(): Buffer | null {
  const raw = process.env.PROFILE_SECRET_KEY?.trim();
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

/** 写入数据库前：无密钥则明文存储 */
export function encryptProfileField(plain: string): string {
  const key = deriveKey();
  if (!key || plain.length === 0) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, enc, tag]);
  return PREFIX + payload.toString('base64url');
}

/** 对外返回或业务逻辑使用：无密钥或非密文则原样返回 */
export function decryptProfileField(stored: string): string {
  const key = deriveKey();
  if (!key || !stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64url');
    if (buf.length < 12 + 16 + 1) return stored;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const data = buf.subarray(12, buf.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return stored;
  }
}
