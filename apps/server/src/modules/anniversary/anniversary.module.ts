import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UserModule } from '../user/user.module';
import { AnniversaryController } from './anniversary.controller';
import { AnniversaryService } from './anniversary.service';
import {
  Anniversary,
  AnniversarySchema,
} from './schemas/anniversary.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Anniversary.name, schema: AnniversarySchema },
    ]),
    AuthModule,
    UserModule,
    RealtimeModule,
  ],
  controllers: [AnniversaryController],
  providers: [AnniversaryService],
  exports: [AnniversaryService],
})
export class AnniversaryModule {}
