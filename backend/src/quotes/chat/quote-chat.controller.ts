import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { QuoteChatService } from './quote-chat.service';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

// Chat entre el cliente y la ferretería de una cotización aceptada. Sin tiempo real: la app consulta cada pocos segundos.
@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuoteChatController {
  constructor(private readonly chat: QuoteChatService) {}

  /** GET /quotes/chat/unread — Mensajes sin leer por cotización */
  @Get('chat/unread')
  async unread(@Req() req: RequestWithUser) {
    return this.chat.noLeidos(req.user.uid);
  }

  /** GET /quotes/:id/messages — Últimos mensajes; marca como leído lo recibido */
  @Get(':id/messages')
  async list(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.chat.listar(id, req.user.uid);
  }

  /** POST /quotes/:id/messages — { text?, attachment?: { dataUrl, name } } (imagen o PDF) */
  @Post(':id/messages')
  async send(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithUser) {
    return this.chat.enviar(id, req.user.uid, body ?? {});
  }
}
