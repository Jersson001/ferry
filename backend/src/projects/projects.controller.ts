import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, Inject, forwardRef } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';
import { PaymentsService } from '../payments/payments.service';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService
  ) {}

  // ==========================================
  // CLIENTES
  // ==========================================

  /** POST /projects — Publicar un nuevo proyecto */
  @Post()
  async createProject(@Req() req: RequestWithUser, @Body() data: any) {
    return this.projectsService.createProject(req.user.uid, data);
  }

  @Get('wompi/signature/:type')
  async getSignature(@Param('type') type: string, @Req() req: RequestWithUser) {
    const amountInCents = type === 'MULTIMEDIA' ? 990000 : 1990000;
    const reference = `PROJECT-${req.user.uid}-${Date.now()}`;
    const signature = this.paymentsService.generateWidgetSignature(reference, amountInCents, 'COP');
    return { reference, amountInCents, currency: 'COP', signature };
  }

  /** GET /projects/own — Mis proyectos publicados */
  @Get('own')
  async getOwnProjects(@Req() req: RequestWithUser) {
    return this.projectsService.getOwnProjects(req.user.uid);
  }

  /** GET /projects/:id/applications — Postulados de un proyecto mío */
  @Get(':id/applications')
  async getApplications(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.projectsService.getProjectApplications(id, req.user.uid);
  }

  /** POST /projects/:id/applications/:appId/accept — Contratar a un postulado */
  @Post(':id/applications/:appId/accept')
  async acceptApplication(
    @Param('id') _projectId: string,
    @Param('appId') appId: string,
    @Req() req: RequestWithUser
  ) {
    return this.projectsService.acceptApplication(appId, req.user.uid);
  }

  /** DELETE /projects/:id — Cancelar mi proyecto */
  @Delete(':id')
  async cancelProject(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.projectsService.cancelProject(id, req.user.uid);
  }

  // ==========================================
  // CONTRATISTAS
  // ==========================================

  /** GET /projects — Muro de oportunidades (feed público, sin datos confidenciales) */
  @Get()
  async getFeed(@Req() req: RequestWithUser) {
    return this.projectsService.getFeed(req.user.uid);
  }

  /** POST /projects/:id/apply — Postularme a un proyecto (cuesta 1 crédito/lead) */
  @Post(':id/apply')
  async applyToProject(@Param('id') id: string, @Req() req: RequestWithUser, @Body() data: any) {
    return this.projectsService.applyToProject(req.user.uid, id, data);
  }

  /** GET /projects/my-applications — Mis postulaciones como contratista */
  @Get('my-applications')
  async getMyApplications(@Req() req: RequestWithUser) {
    return this.projectsService.getMyApplications(req.user.uid);
  }
}
