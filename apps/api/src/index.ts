import path from 'node:path';
import './loadEnv.js';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { AVATARS_DIR, DAILY_IMAGES_DIR } from './paths.js';
import { ensureAvatarsDir } from './lib/avatarFiles.js';
import { ensureDailyImagesDir } from './lib/dailyImageFiles.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { dailyRouter } from './routes/daily.js';
import { homeRouter } from './routes/home.js';

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/momoya';
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-only-change-me';

if (process.env.NODE_ENV === 'production' && SESSION_SECRET === 'dev-only-change-me') {
  console.error('生产环境必须设置 SESSION_SECRET');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.PROFILE_SECRET_KEY?.trim()) {
  console.error('生产环境必须设置 PROFILE_SECRET_KEY（用于加密显示名与简介）');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  await ensureAvatarsDir();
  await ensureDailyImagesDir();

  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 60 * 60 * 24 * 180, includeSubDomains: true }
          : false,
    }),
  );
  app.use(morgan('dev'));
  app.use(express.json({ limit: '512kb' }));

  app.use(
    '/api/static/avatars',
    express.static(AVATARS_DIR, {
      index: false,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'private, max-age=86400');
      },
    }),
  );

  app.use(
    '/api/static/daily-images',
    express.static(DAILY_IMAGES_DIR, {
      index: false,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'private, max-age=86400');
      },
    }),
  );

  app.use(
    session({
      name: 'momoya.sid',
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
      store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 14 * 24 * 60 * 60,
      }),
    }),
  );

  app.use('/api', healthRouter);
  app.use('/api', homeRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/daily', dailyRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(PORT, () => {
    console.log(`API listening on http://127.0.0.1:${PORT}`);
    console.log(`Avatars dir: ${path.resolve(AVATARS_DIR)}`);
    console.log(`Daily images dir: ${path.resolve(DAILY_IMAGES_DIR)}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
