import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TagModule } from '../tag/tag.module';
import { UserModule } from '../user/user.module';
import { EvaluationService } from './evaluation.service';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { Evaluation, EvaluationSchema } from './schemas/evaluation.schema';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import { Post, PostSchema } from './schemas/post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Evaluation.name, schema: EvaluationSchema },
      { name: PostComment.name, schema: PostCommentSchema },
    ]),
    AuthModule,
    UserModule,
    TagModule,
    RealtimeModule,
  ],
  controllers: [PostController],
  providers: [PostService, EvaluationService],
})
export class PostModule {}
