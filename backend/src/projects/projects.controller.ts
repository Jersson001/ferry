import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ==========================================
  // CLIENTES
  // ==========================================
  @Post()
  async createProject(@Req() req: RequestWithUser, @Body() data: any) {
    return this.projectsService.createProject(req.user.uid, data);
  }

  @Get('own')
  async getOwnProjects(@Req() req: RequestWithUser) {
    return this.projectsService.getOwnProjects(req.user.uid);
  }

  @Get(':id/applications')
  async getApplications(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.projectsService.getProjectApplications(id, req.user.uid);
  }

  @Post(':id/applications/:appId/accept')
  async acceptApplication(@Param('id') projectId: string, @Param('appId') appId: string, @Req() req: RequestWithUser) {
    return this.projectsService.acceptApplication(appId, req.user.uid);
  }

  // ==========================================
  // CONTRATISTAS
  // ==========================================
  @Get()
  async getFeed(@Req() req: RequestWithUser) {
    // Si queremos restringir feed solo a contratistas:
    // if (req.user.role !== 'CONTRACTOR') throw new ForbiddenException('Solo contratistas pueden ver el feed');
    return this.projectsService.getFeed();
  }

  @Post(':id/apply')
  async applyToProject(@Param('id') id: string, @Req() req: RequestWithUser, @Body() data: any) {
    // if (req.user.role !== 'CONTRACTOR') throw new ForbiddenException('Solo contratistas');
    return this.projectsService.applyToProject(req.user.uid, id, data);
  }
}
