import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ReferralsService } from './referrals.service';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private referralsService: ReferralsService) {}

  private soloAdmin(req: RequestWithUser) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo administradores');
  }

  @Post('claim')
  async claim(@Req() req: RequestWithUser, @Body('code') code: string) {
    return this.referralsService.reclamar(req.user.uid, code);
  }

  @Get('codes')
  async list(@Req() req: RequestWithUser) {
    this.soloAdmin(req);
    return this.referralsService.listar();
  }

  // Sin `code` el servidor genera uno libre.
  @Post('codes')
  async create(@Req() req: RequestWithUser, @Body('code') code: string, @Body('name') name: string) {
    this.soloAdmin(req);
    return this.referralsService.crear(code, name);
  }

  @Post('codes/:code/active')
  async setActive(@Req() req: RequestWithUser, @Param('code') code: string, @Body('active') active: boolean) {
    this.soloAdmin(req);
    return this.referralsService.activar(code, active !== false);
  }
}
