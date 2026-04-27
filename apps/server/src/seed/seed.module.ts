import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnniversaryModule } from '../modules/anniversary/anniversary.module';
import { PostComment, PostCommentSchema } from '../modules/post/schemas/post-comment.schema';
import { Post, PostSchema } from '../modules/post/schemas/post.schema';
import { UserModule } from '../modules/user/user.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    UserModule,
    AnniversaryModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: PostComment.name, schema: PostCommentSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
