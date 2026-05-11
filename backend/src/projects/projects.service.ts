import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectApplication, ApplicationStatus } from './entities/project-application.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(ProjectApplication)
    private applicationRepository: Repository<ProjectApplication>,
    private subscriptionsService: SubscriptionsService,
    private dataSource: DataSource,
  ) {}

  // ==========================================
  // CLIENTES
  // ==========================================
  async createProject(userId: string, data: any): Promise<Project> {
    const project = this.projectRepository.create({
      title: data.title,
      description: data.description,
      category: data.category,
      budgetInCents: data.budgetInCents,
      location: data.location,
      imageUrl: data.imageUrl,
      userId,
      status: ProjectStatus.OPEN,
    });
    return this.projectRepository.save(project);
  }

  async getOwnProjects(userId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getProjectApplications(projectId: string, userId: string): Promise<ProjectApplication[]> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.userId !== userId) throw new ForbiddenException('No es tu proyecto');

    return this.applicationRepository.find({
      where: { projectId },
      relations: ['contractor'],
      order: { estimatedPriceInCents: 'ASC' }
    });
  }

  async acceptApplication(appId: string, userId: string): Promise<ProjectApplication> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const application = await queryRunner.manager.findOne(ProjectApplication, {
        where: { id: appId },
        relations: ['project'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!application) throw new NotFoundException('Postulación no encontrada');
      if (application.project.userId !== userId) throw new ForbiddenException('No es tu proyecto');
      if (application.status !== ApplicationStatus.PENDING) throw new BadRequestException('Esta postulación ya no está pendiente');

      // 1. Aceptar postulación
      application.status = ApplicationStatus.ACCEPTED;
      await queryRunner.manager.save(application);

      // 2. Rechazar las demás
      await queryRunner.manager.update(ProjectApplication,
        { projectId: application.projectId, status: ApplicationStatus.PENDING },
        { status: ApplicationStatus.REJECTED }
      );

      // 3. Marcar proyecto como en progreso
      const project = application.project;
      project.status = ProjectStatus.IN_PROGRESS;
      await queryRunner.manager.save(project);

      await queryRunner.commitTransaction();
      return application;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ==========================================
  // CONTRATISTAS
  // ==========================================
  async getFeed(): Promise<Project[]> {
    // Solo mostrar proyectos abiertos
    return this.projectRepository.find({
      where: { status: ProjectStatus.OPEN },
      relations: ['user'], // Ocultar info sensible del usuario luego en el DTO
      order: { createdAt: 'DESC' },
    });
  }

  async applyToProject(contractorId: string, projectId: string, data: any): Promise<ProjectApplication> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.status !== ProjectStatus.OPEN) throw new BadRequestException('El proyecto ya no recibe postulaciones');

    // Verificar si ya aplicó
    const existing = await this.applicationRepository.findOne({
      where: { projectId, contractorId }
    });
    if (existing) throw new BadRequestException('Ya te postulaste a este proyecto');

    // COBRAR 1 CRÉDITO - Llama al método atómico del Módulo B-7
    await this.subscriptionsService.deductCredits(
      contractorId, 
      1, 
      `APPLY-${project.id}`
    );

    // Si deductCredits falla, lanza excepción y no llega acá
    
    const application = this.applicationRepository.create({
      projectId,
      contractorId,
      proposal: data.proposal,
      estimatedPriceInCents: data.estimatedPriceInCents,
      status: ApplicationStatus.PENDING,
    });

    return this.applicationRepository.save(application);
  }
}
