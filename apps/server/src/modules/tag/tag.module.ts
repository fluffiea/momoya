import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UserTag, UserTagSchema } from './schemas/user-tag.schema';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserTag.name, schema: UserTagSchema }]),
    AuthModule,
  ],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
