/**
 * Mongoose `timestamps: true` 的 `createdAt` / `updatedAt` 在 schema 上没有 @Prop 声明，
 * 运行期实际是 Date，但在静态类型里会被当作 `unknown`。
 *
 * 这里提供两个小工具做类型收敛 / ISO 字符串化，避免在 controller / service 里到处写
 * `(doc as any).createdAt`。
 */

/**
 * 把任意 "看起来像时间" 的值收敛成 Date：
 *   - 已是 Date：原样返回
 *   - number / ISO string：交给 `new Date(...)`
 *   - null / undefined / 无法解析：返回 "当前时间"（保持对 null 安全）
 */
export function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return new Date();
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * 把任意 "看起来像时间" 的值收敛成 ISO-8601 字符串。
 * 用于 DTO 序列化 (api 出口)。
 */
export function toIsoString(v: unknown): string {
  return toDate(v).toISOString();
}
