import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection, Model } from 'mongoose';
import { BCRYPT_ROUNDS } from '../common/constants/crypto';
import { makeCoupleKey } from '../common/couple-key';
import { AnniversaryService } from '../modules/anniversary/anniversary.service';
import {
  PostComment,
  PostCommentDocument,
} from '../modules/post/schemas/post-comment.schema';
import { Post, PostDocument } from '../modules/post/schemas/post.schema';
import { User, UserDocument } from '../modules/user/schemas/user.schema';

interface SeedUser {
  username: string;
  password: string;
}

const INITIAL_USERS: SeedUser[] = [
  { username: 'jiangjiang', password: '251212' },
  { username: 'mengmeng', password: '251212' },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(PostComment.name)
    private readonly postCommentModel: Model<PostCommentDocument>,
    private readonly anniversaryService: AnniversaryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dropLegacyMomentsCollection();
    const users = await this.seedUsers();
    await this.seedSamplePosts(users);
    await this.seedSystemAnniversary(users);
  }

  /**
   * M4+ 数据迁移：统一 posts 集合后，老的 moments 集合不再被任何代码引用，
   * 启动时直接 drop 掉，避免开发者误以为还有历史数据而混淆调试。
   * 仅在集合存在时删除，幂等。
   */
  private async dropLegacyMomentsCollection(): Promise<void> {
    if (!this.connection.db) return;
    const collections = await this.connection.db
      .listCollections({ name: 'moments' })
      .toArray();
    if (collections.length === 0) return;
    await this.connection.db.dropCollection('moments');
    this.logger.log('[seed] dropped legacy `moments` collection');
  }

  private async seedUsers(): Promise<UserDocument[]> {
    const existing = await this.userModel.estimatedDocumentCount().exec();
    if (existing > 0) {
      this.logger.log('[seed] users exist, skipped');
      return this.userModel.find().exec();
    }

    const created: UserDocument[] = [];
    for (const seed of INITIAL_USERS) {
      const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);
      const doc = await this.userModel.create({
        username: seed.username,
        nickname: seed.username,
        passwordHash,
      });
      created.push(doc);
    }

    if (created.length === 2) {
      const [a, b] = created;
      await this.userModel.updateOne({ _id: a._id }, { partnerId: b._id });
      await this.userModel.updateOne({ _id: b._id }, { partnerId: a._id });
    }

    this.logger.log(
      `[seed] created initial users: ${created.map((u) => u.username).join(', ')}`,
    );
    return this.userModel.find().exec();
  }

  /**
   * 若 posts 集合为空 且 至少有 2 个用户（jiangjiang / mengmeng），
   * 给他们各塞 1 条日常 + 1 条报备样本，方便开发者打开小程序直接看到内容。
   */
  private async seedSamplePosts(users: UserDocument[]): Promise<void> {
    if (users.length < 2) return;
    const count = await this.postModel.estimatedDocumentCount().exec();
    if (count > 0) return;

    const [a, b] = users;
    const now = new Date();
    const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

    const posts = await this.postModel.create([
      {
        authorId: a._id,
        type: 'daily',
        text: '今天终于下班啦',
        images: [],
        tags: ['摸鱼', '下班'],
        happenedAt: minsAgo(10),
      },
      {
        authorId: b._id,
        type: 'daily',
        text: '吃到一家好吃的串串',
        images: [],
        tags: ['吃饭'],
        happenedAt: minsAgo(30),
      },
      {
        authorId: a._id,
        type: 'report',
        text: '中午和同事出去干饭，大概 1h 回来',
        images: [],
        tags: ['干饭'],
        happenedAt: minsAgo(45),
      },
    ]);

    // 给首条 daily 塞一条一级评论 + 作者对该评论的一条回复，方便 UI 调试
    const firstDaily = posts[0];
    const primary = await this.postCommentModel.create({
      postId: firstDaily._id,
      authorId: b._id,
      parentId: null,
      text: '等你下班～',
    });
    await this.postCommentModel.create({
      postId: firstDaily._id,
      authorId: a._id,
      parentId: primary._id,
      text: '路上小心',
    });

    this.logger.log(
      '[seed] inserted sample posts (2 daily + 1 report) + 1 primary comment + 1 reply on first daily',
    );
  }

  /**
   * 为已绑定的 couple 幂等注入「在一起」system 纪念日。
   * 日期兜底取两人中较早的 createdAt（一般是 jiangjiang），作为他们"在一起"的默认日。
   * 已存在则跳过；service 层本身也做幂等，双保险。
   */
  private async seedSystemAnniversary(users: UserDocument[]): Promise<void> {
    if (users.length < 2) return;
    const [a, b] = users;
    if (!a.partnerId || !b.partnerId) return;

    const coupleKey = makeCoupleKey(String(a._id), String(b._id));
    // timestamps 自动字段没被 @Prop 声明，TS 上只能窄到 unknown；运行期是 Date
    const extract = (u: UserDocument): Date | undefined => {
      const ts = (u as unknown as { createdAt?: unknown }).createdAt;
      return ts instanceof Date ? ts : undefined;
    };
    const fallback = extract(a) ?? extract(b) ?? new Date();
    await this.anniversaryService.ensureSystemTogether(coupleKey, fallback);
  }
}
