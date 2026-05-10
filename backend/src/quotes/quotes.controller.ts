import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('quotes')
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('responses/received')
  async getReceived(@Request() req: any) {
    return this.quotesService.getReceivedQuotes(req.user.uid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests/own')
  async getOwnRequests(@Request() req: any) {
    return this.quotesService.getOwnRequests(req.user.uid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests/pending')
  async getPending() {
    return this.quotesService.getPendingRequests();
  }
}
