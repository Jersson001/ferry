import { Controller, Get, Post, Delete, Body, UseGuards, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PushService } from './push.service';
import { endpointValido } from './avisos';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  // Pública: es la clave que el navegador necesita para suscribirse, no un secreto.
  @Get('key')
  clave() {
    return { key: this.push.clavePublica };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async suscribir(@Req() req: RequestWithUser, @Body() body: any) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Los avisos son para ferreterías');
    const { endpoint, keys } = body ?? {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpointValido(endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 256 || auth.length > 256) {
      throw new BadRequestException('Suscripción inválida');
    }
    await this.push.guardar(req.user.uid, { endpoint, p256dh, auth });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscribe')
  async quitar(@Req() req: RequestWithUser, @Body('endpoint') endpoint: string) {
    if (typeof endpoint === 'string') await this.push.quitar(req.user.uid, endpoint);
    return { ok: true };
  }
}
