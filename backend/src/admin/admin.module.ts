import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [UsersModule, SubscriptionsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
