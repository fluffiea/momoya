/**
 * 解析形如 '30s' / '15m' / '2h' / '14d' 的时长字符串为秒数。
 * 如果是纯数字视为秒。未识别则抛错。
 */
export function parseDurationToSeconds(input: string): number {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
  if (!match) {
    throw new Error(`无法解析时长字符串: ${input}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`不支持的时长单位: ${unit}`);
  }
}
