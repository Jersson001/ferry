import { Controller, Put, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { sanitizarPerfil, perfilPropio } from './perfil';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const { profileComplete } = body ?? {};

    // Mapeamos el campo del frontend al de la base de datos
    const finalUpdates = {
      ...sanitizarPerfil(body ?? {}),
      isProfileComplete: profileComplete ?? true
    };

    return perfilPropio(await this.usersService.update(req.user.uid, finalUpdates));
  }
}
