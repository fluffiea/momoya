import type { UserDoc } from '../models/User.js';

declare global {
  namespace Express {
    interface Locals {
      /** `requireAuth` 校验通过后挂载的当前用户文档 */
      authUser?: UserDoc;
    }
  }
}

export {};
