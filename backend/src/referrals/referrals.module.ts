import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral, ReferralCode } from './entities/referral.entity';
import { User } from '../users/user.entity';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReferralCode, Referral, User])],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
