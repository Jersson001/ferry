import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // ── Registro ────────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const { email, password, displayName, role } = dto;

    // Verificar duplicado de email
    const existing = await this.usersService.findOneByEmail(email);
    if (existing) {
      throw new BadRequestException('Este correo ya está registrado. Intenta iniciar sesión.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const name = displayName?.trim() || (role === 'STORE' ? 'Mi Ferretería' : 'Usuario');

    const user = await this.usersService.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      displayName: name,
      role,
    });

    const token = this.signToken(user.uid, user.email!, user.role);

    return {
      access_token: token,
      user: this.safeUser(user),
    };
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.usersService.findOneByEmail(email.toLowerCase().trim());
    if (!user) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    if (!user.password) {
      throw new UnauthorizedException('Esta cuenta no tiene contraseña configurada');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const token = this.signToken(user.uid, user.email!, user.role);

    return {
      access_token: token,
      user: this.safeUser(user),
    };
  }

  // ── Perfil propio (GET /auth/me) ─────────────────────────────────────────────
  async getMe(uid: string) {
    const user = await this.usersService.findOne(uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.safeUser(user);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private signToken(uid: string, email: string, role: string): string {
    return this.jwtService.sign({ sub: uid, email, role });
  }

  private safeUser(user: any) {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
