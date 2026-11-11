import { Controller, Put, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { sanitizarPerfil, perfilPropio } from './perfil';
import { VerificadorRutService, camposDeRut } from './verificador-rut.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private verificadorRut: VerificadorRutService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const { profileComplete } = body ?? {};

    // Mapeamos el campo del frontend al de la base de datos
    const finalUpdates: Record<string, unknown> = {
      ...sanitizarPerfil(body ?? {}),
      isProfileComplete: profileComplete ?? true
    };

    // El RUT se verifica aquí (DV y registro mercantil); el resultado lo escribe el servidor.
    if (typeof finalUpdates.rut === 'string') {
      const actual = await this.usersService.findOne(req.user.uid);
      Object.assign(finalUpdates, await camposDeRut(finalUpdates.rut, actual, this.verificadorRut));
    }

    return perfilPropio(await this.usersService.update(req.user.uid, finalUpdates));
  }
}
