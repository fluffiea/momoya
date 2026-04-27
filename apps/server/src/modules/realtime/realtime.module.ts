import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { CoupleGateway } from './couple.gateway';
import { CoupleRealtimeService } from './couple-realtime.service';

@Module({
  imports: [AuthModule, UserModule],
  providers: [CoupleGateway, CoupleRealtimeService],
  exports: [CoupleRealtimeService],
})
export class RealtimeModule {}
