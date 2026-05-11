import { 
  Controller, Get, Post, Delete, Param, UseGuards, 
  UseInterceptors, UploadedFile, Body, Req 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PortfolioService } from './portfolio.service';
import { Request } from 'express';

// Define expected custom property on Request object populated by JwtAuthGuard
interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('items')
  async getMyPortfolio(@Req() req: RequestWithUser) {
    return this.portfolioService.findAllByUser(req.user.uid);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new Error('Archivo requerido (campo "file")');
    }
    return this.portfolioService.uploadAndCreate(file, req.user.uid, description);
  }

  @Post('items/link')
  async addLink(
    @Req() req: RequestWithUser,
    @Body('url') url: string,
    @Body('description') description?: string,
  ) {
    if (!url) {
      throw new Error('URL es requerida');
    }
    return this.portfolioService.createLink(req.user.uid, url, description);
  }

  @Delete('items/:id')
  async deleteItem(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.portfolioService.deleteItem(id, req.user.uid);
    return { success: true, message: 'Item eliminado' };
  }
}
