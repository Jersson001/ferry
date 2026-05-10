import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/catalog')
  async getCatalog(@Param('id') id: string) {
    return this.storesService.getCatalog(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/families')
  async getFamilies(@Param('id') id: string) {
    return this.storesService.getFamilies(id);
  }
}
