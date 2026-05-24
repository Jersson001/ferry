import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { QuotesModule } from './quotes/quotes.module';
import { StoresModule } from './stores/stores.module';
import { StorageModule } from './storage/storage.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PaymentsModule } from './payments/payments.module';
import { AiModule } from './ai/ai.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ProjectsModule } from './projects/projects.module';
import { AdminModule } from './admin/admin.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'rootpassword',
      database: process.env.DATABASE_NAME || 'ferry_db',
      autoLoadEntities: true,
      synchronize: true, // Solo desarrollo — en producción usar migraciones
    }),
    UsersModule,
    AuthModule,
    QuotesModule,
    StoresModule,
    StorageModule,
    PortfolioModule,
    PaymentsModule,
    AiModule,
    SubscriptionsModule,
    ProjectsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
