import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectApplication, ApplicationStatus } from './entities/project-application.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(ProjectApplication)
    private applicationRepository: Repository<ProjectApplication>,
    private subscriptionsService: SubscriptionsService,
    private storageService: StorageService,
    private dataSource: DataSource,
  ) {}

  // ==========================================
  // CLIENTES
  // ==========================================
  async createProject(userId: string, data: any): Promise<Project> {
    const processedMediaUrls: string[] = [];
    if (data.mediaUrls && Array.isArray(data.mediaUrls)) {
      for (const media of data.mediaUrls) {
        if (typeof media === 'string' && media.startsWith('data:image')) {
          const savedUrl = await this.storageService.saveBase64Image(media, userId, 'projects');
          processedMediaUrls.push(savedUrl);
        } else if (typeof media === 'string') {
          processedMediaUrls.push(media);
        }
      }
    }

    const project = this.projectRepository.create({
      title: data.title,
      description: data.description,
      category: data.category,
      budgetInCents: data.budgetInCents,
      location: data.location,             // Ciudad / Zona — público
      exactAddress: data.exactAddress,     // Dirección confidencial — oculta
      contactPhone: data.contactPhone,     // Teléfono confidencial — oculto
      isUrgent: data.isUrgent ?? false,
      imageUrl: data.imageUrl,
      postType: data.postType ?? 'STANDARD',
      mediaUrls: processedMediaUrls,
      userId,
      status: ProjectStatus.OPEN,
    });
    return this.projectRepository.save(project);
  }

  async getOwnProjects(userId: string): Promise<any[]> {
    const projects = await this.projectRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Count applications per project
    const result = await Promise.all(projects.map(async (p) => {
      const count = await this.applicationRepository.count({ where: { projectId: p.id } });
      return { ...p, applicationCount: count };
    }));

    return result;
  }

  async getProjectApplications(projectId: string, userId: string): Promise<any[]> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.userId !== userId) throw new ForbiddenException('No es tu proyecto');

    const applications = await this.applicationRepository.find({
      where: { projectId },
      relations: ['contractor'],
      order: { estimatedPriceInCents: 'ASC' }
    });

    // Map contractor data from their user profile
    return applications.map(app => ({
      id: app.id,
      status: app.status,
      proposal: app.proposal,
      estimatedPriceInCents: app.estimatedPriceInCents,
      createdAt: app.createdAt,
      contractor: {
        uid: app.contractor.uid,
        displayName: app.contractor.displayName,
        photoURL: app.contractor.photoURL ?? null,
        description: (app.contractor as any).description ?? null,
        specialties: (app.contractor as any).specialties ?? [],
        isProfileComplete: (app.contractor as any).isProfileComplete ?? false,
      }
    }));
  }

  async acceptApplication(appId: string, userId: string): Promise<any> {
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

      // Return with revealed confidential data (address + phone)
      return {
        ...application,
        revealedAddress: project.exactAddress ?? null,
        revealedPhone: project.contactPhone ?? null,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelProject(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.userId !== userId) throw new ForbiddenException('No es tu proyecto');
    if (project.status === ProjectStatus.IN_PROGRESS) throw new BadRequestException('No puedes cancelar un proyecto en progreso');

    project.status = ProjectStatus.CANCELLED;
    return this.projectRepository.save(project);
  }

  // ==========================================
  // CONTRATISTAS
  // ==========================================
  async getFeed(userId: string): Promise<any[]> {
    const projects = await this.projectRepository.find({
      where: { status: ProjectStatus.OPEN, userId: Not(userId) },
      relations: ['user'],
      order: {
        postType: 'DESC', // 'VIP' > 'STANDARD' > 'MULTIMEDIA' in alphabetic terms, wait, V > S > M. So VIP is first!
        createdAt: 'DESC'
      },
    });

    // Omit confidential fields from public feed
    return projects.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      budgetInCents: p.budgetInCents,
      location: p.location,          // Ciudad/Zona pública
      isUrgent: p.isUrgent,
      status: p.status,
      postType: p.postType,
      mediaUrls: p.mediaUrls,
      createdAt: p.createdAt,
      postedBy: p.user?.displayName ?? 'Cliente anónimo',
      // exactAddress and contactPhone intentionally OMITTED
    }));
  }

  async applyToProject(contractorId: string, projectId: string, data: any): Promise<ProjectApplication> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.status !== ProjectStatus.OPEN) throw new BadRequestException('El proyecto ya no recibe postulaciones');
    if (project.userId === contractorId) throw new BadRequestException('No puedes aplicar a tu propio proyecto');

    // Verificar si ya aplicó
    const existing = await this.applicationRepository.findOne({
      where: { projectId, contractorId }
    });
    if (existing) throw new BadRequestException('Ya te postulaste a este proyecto');

    // COBRAR 1 CRÉDITO (Lead) — Sistema de suscripciones
    await this.subscriptionsService.deductCredits(
      contractorId,
      1,
      `APPLY-${project.id}`
    );

    const application = this.applicationRepository.create({
      projectId,
      contractorId,
      proposal: data.proposal,
      estimatedPriceInCents: data.estimatedPriceInCents,
      status: ApplicationStatus.PENDING,
    });

    return this.applicationRepository.save(application);
  }

  async getMyApplications(contractorId: string): Promise<any[]> {
    const applications = await this.applicationRepository.find({
      where: { contractorId },
      relations: ['project'],
      order: { createdAt: 'DESC' },
    });

    return applications.map(app => ({
      id: app.id,
      status: app.status,
      proposal: app.proposal,
      estimatedPriceInCents: app.estimatedPriceInCents,
      createdAt: app.createdAt,
      project: {
        id: app.project.id,
        title: app.project.title,
        category: app.project.category,
        location: app.project.location,
        status: app.project.status,
        // Only reveal address to accepted contractors
        revealedAddress: app.status === ApplicationStatus.ACCEPTED ? app.project.exactAddress ?? null : null,
        revealedPhone: app.status === ApplicationStatus.ACCEPTED ? app.project.contactPhone ?? null : null,
      }
    }));
  }
}
