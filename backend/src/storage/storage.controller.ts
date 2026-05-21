import { 
  Controller, Post, UseGuards, 
  UseInterceptors, UploadedFile, Req 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from './storage.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('Archivo requerido');
    }
    const url = await this.storageService.saveFile(file, req.user.uid, 'projects');
    return { url };
  }
}
