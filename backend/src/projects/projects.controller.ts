import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
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

  /** POST /projects/:id/complete — Dar por terminado el proyecto (y calificar al contratista, opcional) */
  @Post(':id/complete')
  async completeProject(@Param('id') id: string, @Body('rating') rating: number, @Body('comment') comment: string, @Req() req: RequestWithUser) {
    return this.projectsService.terminarProyecto(id, req.user.uid, rating, comment);
  }

  /** POST /projects/:id/rate — Calificar al contratista de un proyecto ya terminado */
  @Post(':id/rate')
  async rateContractor(@Param('id') id: string, @Body('rating') rating: number, @Body('comment') comment: string, @Req() req: RequestWithUser) {
    return this.projectsService.calificarContratista(id, req.user.uid, rating, comment);
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

  /** GET /projects/me/reviews — Mis opiniones como contratista, con id para responder */
  @Get('me/reviews')
  async getMyReviews(@Req() req: RequestWithUser) {
    return this.projectsService.getOpinionesContratista(req.user.uid, 50, true);
  }

  /** GET /projects/contractor/:id/reviews — Opiniones visibles de un contratista */
  @Get('contractor/:id/reviews')
  async getContractorReviews(@Param('id') id: string) {
    return this.projectsService.getOpinionesContratista(id, 20);
  }

  /** POST /projects/applications/:appId/review-reply — El contratista responde a su opinión */
  @Post('applications/:appId/review-reply')
  async replyToReview(@Param('appId') appId: string, @Body('text') text: string, @Req() req: RequestWithUser) {
    return this.projectsService.responderOpinion(appId, req.user.uid, text);
  }

  @Post('applications/:appId/review-hidden')
  async hideReview(@Param('appId') appId: string, @Body('hidden') hidden: boolean, @Req() req: RequestWithUser) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo administradores');
    return this.projectsService.ocultarOpinion(appId, hidden !== false);
  }

  /** GET /projects/applications/:appId/contact/signature — Firma Wompi para pagar el contacto del cliente */
  @Get('applications/:appId/contact/signature')
  async getContactSignature(@Param('appId') appId: string, @Req() req: RequestWithUser) {
    const { amountInCents } = await this.projectsService.contactoPorPagar(appId, req.user.uid);
    const reference = `CONTACT_${appId}_${Date.now()}`;
    const signature = this.paymentsService.generateWidgetSignature(reference, amountInCents, 'COP');
    return { reference, amountInCents, currency: 'COP', signature };
  }

  /** POST /projects/applications/:appId/contact/verify — Confirma el pago y muestra el contacto */
  @Post('applications/:appId/contact/verify')
  async verifyContactPayment(@Param('appId') appId: string, @Body('transactionId') transactionId: string, @Req() req: RequestWithUser) {
    return this.paymentsService.verifyWompiContactTransaction(transactionId, req.user.uid, appId);
  }

  /** GET /projects/my-applications — Mis postulaciones como contratista */
  @Get('my-applications')
  async getMyApplications(@Req() req: RequestWithUser) {
    return this.projectsService.getMyApplications(req.user.uid);
  }
}
