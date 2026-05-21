import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';
import { ProjectApplication } from './entities/project-application.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectApplication]),
    SubscriptionsModule, // Importamos el Módulo B-7 para descontar créditos
    StorageModule,
    forwardRef(() => PaymentsModule)
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
