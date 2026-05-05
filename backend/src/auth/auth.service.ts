import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async register(data: any) {
    const { email, password, displayName, role } = data;
    if (email) {
      const existingUser = await this.usersService.findOneByEmail(email);
      if (existingUser) throw new BadRequestException('El correo ya está en uso');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      displayName: displayName || (role === 'STORE' ? 'Mi Ferretería' : 'Usuario'),
      role: role || 'USER',
    });
    
    return {
      access_token: this.jwtService.sign({ sub: user.uid, email: user.email, role: user.role }),
      user: { uid: user.uid, email: user.email, displayName: user.displayName, role: user.role }
    };
  }

  async login(data: any) {
    const { email, password } = data;
    const user = await this.usersService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciales inválidas');

    return {
      access_token: this.jwtService.sign({ sub: user.uid, email: user.email, role: user.role }),
      user: { uid: user.uid, email: user.email, displayName: user.displayName, role: user.role }
    };
  }
}
