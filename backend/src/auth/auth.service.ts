import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  // ── Registro ─────────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const { email, password, displayName, role } = dto;

    // Verificar duplicado de email
    const existing = await this.usersService.findOneByEmail(email);
    if (existing) {
      throw new BadRequestException('Este correo ya está registrado. Intenta iniciar sesión.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const name = displayName?.trim() || (role === 'STORE' ? 'Mi Ferretería' : 'Usuario');

    // Generar token de verificación de email
    const emailVerificationToken = crypto.randomUUID();

    const user = await this.usersService.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      displayName: name,
      role,
      isEmailVerified: false,
      emailVerificationToken,
    });

    // Enviar email de verificación (no-blocking — error no rompe el flujo)
    this.mailService
      .sendVerificationEmail(user.email!, name, emailVerificationToken)
      .catch(() => null);

    const token = this.signToken(user.uid, user.email!, user.role);

    return {
      access_token: token,
      user: this.safeUser(user),
      message: 'Cuenta creada. Revisa tu correo para verificarla.',
    };
  }

  // ── Login ─────────────────────────────────────────────────────────────────────
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

  // ── Verificar email ───────────────────────────────────────────────────────────
  async verifyEmail(dto: VerifyEmailDto) {
    const { token } = dto;

    const user = await this.usersService.findOneByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('El enlace de verificación no es válido o ya fue usado.');
    }

    if (user.isEmailVerified) {
      return { message: 'Tu correo ya ha sido verificado.' };
    }

    await this.usersService.update(user.uid, {
      isEmailVerified: true,
      emailVerificationToken: null,
    });

    return { message: '¡Correo verificado con éxito! Ya puedes usar todas las funciones de Ferry.' };
  }

  // ── Reenviar verificación ─────────────────────────────────────────────────────
  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.usersService.findOneByEmail(dto.email.toLowerCase().trim());

    // Por seguridad, no revelamos si el email existe o no en caso de que no esté registrado
    if (!user) {
      return { message: 'Si tu correo está registrado y sin verificar, recibirás un nuevo enlace.' };
    }

    if (user.isEmailVerified) {
      return { message: 'Tu correo ya está verificado.' };
    }

    const emailVerificationToken = crypto.randomUUID();
    await this.usersService.update(user.uid, { emailVerificationToken });

    this.mailService
      .sendVerificationEmail(user.email!, user.displayName, emailVerificationToken)
      .catch(() => null);

    return { message: 'Si tu correo está registrado y sin verificar, recibirás un nuevo enlace.' };
  }

  // ── Olvidé mi contraseña ──────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findOneByEmail(dto.email.toLowerCase().trim());

    // Por seguridad, siempre respondemos igual (no revelamos si el email existe)
    if (!user) {
      return { message: 'Si tu correo está registrado, recibirás instrucciones para restablecer tu contraseña.' };
    }

    const resetPasswordToken = crypto.randomUUID();
    const resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.usersService.update(user.uid, {
      resetPasswordToken,
      resetPasswordExpiry,
    });

    this.mailService
      .sendPasswordResetEmail(user.email!, user.displayName, resetPasswordToken)
      .catch(() => null);

    return { message: 'Si tu correo está registrado, recibirás instrucciones para restablecer tu contraseña.' };
  }

  // ── Restablecer contraseña ────────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const { token, password } = dto;

    const user = await this.usersService.findOneByResetToken(token);
    if (!user) {
      throw new BadRequestException('El enlace para restablecer la contraseña no es válido o ya fue usado.');
    }

    // Verificar expiración (1 hora)
    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < new Date()) {
      throw new BadRequestException('El enlace ha expirado. Solicita uno nuevo desde la pantalla de inicio de sesión.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await this.usersService.update(user.uid, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
    });

    return { message: 'Contraseña restablecida con éxito. Ya puedes iniciar sesión.' };
  }

  // ── Perfil propio (GET /auth/me) ──────────────────────────────────────────────
  async getMe(uid: string) {
    const user = await this.usersService.findOne(uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.safeUser(user);
  }

  // ── Change Password ──────────────────────────────────────────────────────────
  async changePassword(uid: string, dto: import('./dto/change-password.dto').ChangePasswordDto) {
    const user = await this.usersService.findOne(uid);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.password) {
      throw new BadRequestException('Esta cuenta usa un proveedor externo (ej. Google)');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const newHashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.update(uid, { password: newHashedPassword });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private signToken(uid: string, email: string, role: string): string {
    return this.jwtService.sign({ sub: uid, email, role });
  }

  private safeUser(user: any) {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified ?? false,
      isProfileComplete: user.isProfileComplete ?? false,
      location: user.location ?? null,
      description: user.description ?? null,
      specialties: user.specialties ?? null,
      photoURL: user.photoURL ?? null,
      rut: user.rut ?? null,
      createdAt: user.createdAt,
    };
  }
}
