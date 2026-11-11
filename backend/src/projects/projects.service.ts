import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { ProjectApplication, ApplicationStatus } from './entities/project-application.entity';
import { User } from '../users/user.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StorageService } from '../storage/storage.service';
import { armarOpiniones, limpiarTexto, Opinion } from '../stores/opiniones';
import { ConflictException } from '@nestjs/common';

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
      if (p.status !== ProjectStatus.IN_PROGRESS && p.status !== ProjectStatus.COMPLETED) return { ...p, applicationCount: count };
      const contratada = await this.applicationRepository.findOne({
        where: { projectId: p.id, status: ApplicationStatus.ACCEPTED },
        relations: ['contractor'],
      });
      return {
        ...p,
        applicationCount: count,
        hiredName: contratada?.contractor?.displayName ?? null,
        rated: contratada?.rating != null,
      };
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

    const reputacion = await this.reputacionDe(applications.map(a => a.contractorId));

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
        rating: reputacion.get(app.contractorId) ?? { rating: null, reviews: 0 },
      }
    }));
  }

  // Promedio y número de opiniones visibles de varios contratistas, en una sola consulta.
  async reputacionDe(contractorIds: string[]): Promise<Map<string, { rating: number | null; reviews: number }>> {
    const ids = [...new Set(contractorIds.filter(Boolean))];
    const r = new Map<string, { rating: number | null; reviews: number }>();
    if (ids.length === 0) return r;
    const filas = await this.applicationRepository
      .createQueryBuilder('a')
      .select('a.contractorId', 'id')
      .addSelect('AVG(a.rating)', 'average')
      .addSelect('COUNT(a.rating)', 'reviews')
      .where('a.contractorId IN (:...ids)', { ids })
      .andWhere('a.rating BETWEEN 1 AND 5')
      .andWhere('a.reviewHidden = false')
      .groupBy('a.contractorId')
      .getRawMany<{ id: string; average: string; reviews: string }>();
    for (const f of filas) {
      const reviews = Number(f.reviews);
      const average = Number(f.average);
      r.set(f.id, { rating: reviews > 0 && Number.isFinite(average) ? Math.round(average * 10) / 10 : null, reviews });
    }
    return r;
  }

  // Opiniones visibles de un contratista, de la más reciente a la más antigua. `propias` agrega el id para responder.
  async getOpinionesContratista(contractorId: string, limite: number, propias = false): Promise<{ rating: number | null; reviews: number; items: Opinion[] }> {
    const filas = await this.applicationRepository
      .createQueryBuilder('a')
      .innerJoin('a.project', 'p')
      .innerJoin(User, 'u', 'u.uid = p.userId')
      .select('a.id', 'id')
      .addSelect('a.rating', 'rating')
      .addSelect('a.reviewComment', 'reviewComment')
      .addSelect('a.reviewReply', 'reviewReply')
      .addSelect('a.reviewedAt', 'reviewedAt')
      .addSelect('a.reviewRepliedAt', 'reviewRepliedAt')
      .addSelect('u.displayName', 'authorName')
      .where('a.contractorId = :contractorId', { contractorId })
      .andWhere('a.rating BETWEEN 1 AND 5')
      .andWhere('a.reviewHidden = false')
      .orderBy('a.reviewedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('a.createdAt', 'DESC')
      .limit(limite)
      .getRawMany();
    const resumen = (await this.reputacionDe([contractorId])).get(contractorId) ?? { rating: null, reviews: 0 };
    return { ...resumen, items: armarOpiniones(filas, propias) };
  }

  // El cliente da por terminado el proyecto contratado y, si quiere, califica de una vez al contratista.
  async terminarProyecto(projectId: string, userId: string, rating?: unknown, comment?: unknown): Promise<{ completed: true; rated: boolean }> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.userId !== userId) throw new ForbiddenException('No es tu proyecto');
    if (project.status !== ProjectStatus.IN_PROGRESS) throw new BadRequestException('Solo se puede terminar un proyecto en progreso');
    project.status = ProjectStatus.COMPLETED;
    await this.projectRepository.save(project);
    const valida = Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 5;
    if (valida) await this.guardarCalificacion(projectId, rating as number, comment);
    return { completed: true, rated: valida };
  }

  // Calificar después de haber terminado sin calificar. Una sola vez.
  async calificarContratista(projectId: string, userId: string, rating: unknown, comment: unknown): Promise<{ rated: true }> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.userId !== userId) throw new ForbiddenException('No es tu proyecto');
    if (project.status !== ProjectStatus.COMPLETED) throw new BadRequestException('Primero termina el proyecto');
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) throw new BadRequestException('La calificación va de 1 a 5');
    await this.guardarCalificacion(projectId, rating as number, comment);
    return { rated: true };
  }

  private async guardarCalificacion(projectId: string, rating: number, comment: unknown): Promise<void> {
    const app = await this.applicationRepository.findOne({ where: { projectId, status: ApplicationStatus.ACCEPTED } });
    if (!app) throw new NotFoundException('Este proyecto no tiene un contratista contratado');
    if (app.rating != null) throw new ConflictException('Ya calificaste a este contratista');
    app.rating = rating;
    app.reviewComment = limpiarTexto(comment);
    app.reviewedAt = new Date();
    await this.applicationRepository.save(app);
  }

  // El contratista responde una vez a la opinión recibida. No puede editarla ni borrarla.
  async responderOpinion(appId: string, contractorId: string, texto: unknown): Promise<{ reply: string }> {
    const app = await this.applicationRepository.findOne({ where: { id: appId } });
    if (!app || app.contractorId !== contractorId) throw new NotFoundException('Opinión no encontrada');
    if (app.rating == null) throw new BadRequestException('Este proyecto aún no tiene calificación');
    if (app.reviewReply) throw new ConflictException('Ya respondiste esta opinión');
    const reply = limpiarTexto(texto);
    if (!reply) throw new BadRequestException('Escribe tu respuesta');
    app.reviewReply = reply;
    app.reviewRepliedAt = new Date();
    await this.applicationRepository.save(app);
    return { reply };
  }

  // Solo el administrador: oculta (o vuelve a mostrar) una opinión abusiva.
  async ocultarOpinion(appId: string, oculta: boolean): Promise<{ hidden: boolean }> {
    const app = await this.applicationRepository.findOne({ where: { id: appId } });
    if (!app || app.rating == null) throw new NotFoundException('Opinión no encontrada');
    app.reviewHidden = oculta;
    await this.applicationRepository.save(app);
    return { hidden: oculta };
  }

  async acceptApplication(appId: string, userId: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Postgres no deja usar FOR UPDATE con el LEFT JOIN de `relations`, así que se bloquea cada
      // fila por separado. Primero el proyecto: dos aceptaciones simultáneas del mismo proyecto
      // quedan en fila y la segunda ve que ya no está abierto.
      const found = await queryRunner.manager.findOne(ProjectApplication, { where: { id: appId } });
      if (!found) throw new NotFoundException('Postulación no encontrada');

      const project = await queryRunner.manager.findOne(Project, {
        where: { id: found.projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Proyecto no encontrado');
      if (project.userId !== userId) throw new ForbiddenException('No es tu proyecto');
      if (project.status !== ProjectStatus.OPEN) throw new BadRequestException('Este proyecto ya no está abierto');

      const application = await queryRunner.manager.findOne(ProjectApplication, {
        where: { id: appId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!application || application.status !== ApplicationStatus.PENDING) throw new BadRequestException('Esta postulación ya no está pendiente');

      // 1. Aceptar postulación
      application.status = ApplicationStatus.ACCEPTED;
      await queryRunner.manager.save(application);

      // 2. Rechazar las demás
      await queryRunner.manager.update(ProjectApplication,
        { projectId: application.projectId, status: ApplicationStatus.PENDING },
        { status: ApplicationStatus.REJECTED }
      );

      // 3. Marcar proyecto como en progreso
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
    const proposal = typeof data?.proposal === 'string' ? data.proposal.trim() : '';
    if (proposal.length < 10) throw new BadRequestException('Escribe tu propuesta (mínimo 10 caracteres)');
    if (proposal.length > 2000) throw new BadRequestException('La propuesta no puede pasar de 2000 caracteres');
    const price = Number(data?.estimatedPriceInCents);
    // Entre $1.000 y $10.000 millones de pesos, en centavos
    if (!Number.isInteger(price) || price < 100_000 || price > 1_000_000_000_000) {
      throw new BadRequestException('Escribe un precio estimado válido');
    }

    // Cobro del crédito y postulación van en una sola transacción: o quedan las dos cosas, o ninguna.
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id: projectId } });
      if (!project) throw new NotFoundException('Proyecto no encontrado');
      if (project.status !== ProjectStatus.OPEN) throw new BadRequestException('El proyecto ya no recibe postulaciones');
      if (project.userId === contractorId) throw new BadRequestException('No puedes aplicar a tu propio proyecto');

      // Primero el cobro: bloquea la fila de créditos del contratista, así dos envíos seguidos
      // se atienden uno tras otro y el segundo sí ve la postulación del primero.
      await this.subscriptionsService.deductCredits(contractorId, 1, `APPLY-${project.id}`, manager);

      const existing = await manager.findOne(ProjectApplication, { where: { projectId, contractorId } });
      if (existing) throw new BadRequestException('Ya te postulaste a este proyecto');

      const application = manager.create(ProjectApplication, {
        projectId,
        contractorId,
        proposal,
        estimatedPriceInCents: price,
        status: ApplicationStatus.PENDING,
      });
      return manager.save(application);
    });
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
