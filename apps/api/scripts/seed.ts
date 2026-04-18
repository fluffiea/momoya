import '../src/loadEnv.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.js';
import { DailyEntryModel } from '../src/models/DailyEntry.js';
import { encryptProfileField } from '../src/lib/fieldCrypto.js';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/momoya';

const ANNIVERSARY = new Date(2025, 11, 12, 22, 2, 0);

async function seed() {
  await mongoose.connect(MONGODB_URI);

  const pwJiang = process.env.SEED_PASSWORD_JIANGJIANG;
  const pwMeng = process.env.SEED_PASSWORD_MENGMENG;
  if (!pwJiang || !pwMeng) {
    throw new Error('请设置环境变量 SEED_PASSWORD_JIANGJIANG 与 SEED_PASSWORD_MENGMENG');
  }

  const users = [
    {
      username: 'jiangjiang',
      password: pwJiang,
      profile: {
        displayName: encryptProfileField('江江'),
        bio: encryptProfileField(''),
        avatarUrl: '',
      },
    },
    {
      username: 'mengmeng',
      password: pwMeng,
      profile: {
        displayName: encryptProfileField('萌萌'),
        bio: encryptProfileField(''),
        avatarUrl: '',
      },
    },
  ];

  for (const u of users) {
    const existing = await User.findOne({ username: u.username });
    if (existing) {
      console.log(`用户已存在，跳过: ${u.username}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 12);
    await User.create({
      username: u.username,
      passwordHash,
      profile: u.profile,
    });
    console.log(`已创建用户: ${u.username}`);
  }

  const count = await DailyEntryModel.countDocuments();
  if (count === 0) {
    await DailyEntryModel.create({
      at: ANNIVERSARY,
      body:
        '从这一刻起，「喜欢」有了确切的时间：冬天里很普通的一个晚上，因为彼此点头，变成了我们的起点。以后日历上的每一天，都算在「一起」里。',
      tags: [
        { id: 'together', label: '我们在一起' },
        { id: 'start', label: '起点' },
      ],
      createdByUsername: 'system',
      updatedByUsername: 'system',
    });
    console.log('已写入默认日常条目');
  } else {
    console.log('日常条目已存在，跳过种子');
  }

  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
