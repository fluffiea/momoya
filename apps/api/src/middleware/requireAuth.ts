import type { RequestHandler } from 'express';
import { validateSessionOr401 } from './sessionAuth.js';

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const user = await validateSessionOr401(req, res);
    if (!user) return;
    res.locals.authUser = user;
    next();
  } catch (err) {
    next(err);
  }
};
