/**
 * 情侣共享 key：把两个 userId 字符串按字典序排后拼接。
 * 任意一方都能算出同一个 key，查询/写入/实时房间都走它。
 */
export function makeCoupleKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}
