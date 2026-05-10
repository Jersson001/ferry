import { Controller, Put, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    const { profileComplete, ...updates } = body;
    
    // Mapeamos el campo del frontend al de la base de datos
    const finalUpdates = {
      ...updates,
      isProfileComplete: profileComplete ?? true
    };

    return this.usersService.update(req.user.uid, finalUpdates);
  }
}
