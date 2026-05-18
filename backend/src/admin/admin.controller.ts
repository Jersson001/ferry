import { Controller, Get, Post, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkAdmin(req: RequestWithUser) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Acceso restringido al Modo Dios (ADMIN).');
    }
  }

  @Get('users-with-subscriptions')
  async getUsersWithSubscriptions(@Req() req: RequestWithUser) {
    this.checkAdmin(req);
    return this.adminService.getUsersWithSubscriptions();
  }

  @Post('assign-plan/:userId/:planId')
  async assignPlan(
    @Param('userId') userId: string,
    @Param('planId') planId: string,
    @Req() req: RequestWithUser,
  ) {
    this.checkAdmin(req);
    return this.adminService.assignPlan(userId, planId);
  }
}
