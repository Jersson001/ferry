import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';
import { QuoteStatus } from './entities/quote.entity';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  // ==========================================
  // CLIENTE
  // ==========================================
  @Post('requests')
  async createRequest(@Req() req: RequestWithUser, @Body() data: any) {
    return this.quotesService.createRequest(req.user.uid, data);
  }

  @Get('requests/own')
  async getOwnRequests(@Req() req: RequestWithUser) {
    return this.quotesService.getOwnRequests(req.user.uid);
  }

  @Get('responses/received')
  async getReceived(@Req() req: RequestWithUser) {
    return this.quotesService.getReceivedQuotes(req.user.uid);
  }

  @Post(':id/accept')
  async acceptQuote(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.acceptQuote(id, req.user.uid);
  }

  @Post(':id/reject')
  async rejectQuote(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.updateQuoteStatus(id, QuoteStatus.REJECTED, req.user.uid, false);
  }



  @Post(':id/status')
  async updateStatus(
    @Param('id') id: string, 
    @Body('status') status: QuoteStatus, 
    @Body('rating') rating: number,
    @Body('comment') comment: string,
    @Req() req: RequestWithUser
  ) {
    return this.quotesService.updateQuoteStatus(id, status, req.user.uid, false, rating, comment);
  }

  // ==========================================
  // FERRETERÍA
  // ==========================================
  @Get('requests/pending')
  async getPending(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.getPendingRequests();
  }

  @Get('responses/sent')
  async getSentQuotes(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.getSentQuotes(req.user.uid);
  }

  @Post('responses')
  async createResponse(@Req() req: RequestWithUser, @Body() data: any) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.createQuote(req.user.uid, data.requestId, data);
  }

  @Post(':id/logistic-status')
  async updateLogisticStatus(@Param('id') id: string, @Body('status') status: QuoteStatus, @Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.updateQuoteStatus(id, status, req.user.uid, true);
  }
}
