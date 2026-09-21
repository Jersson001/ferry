import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'FATAL: La variable de entorno JWT_SECRET no está configurada. ' +
        'La aplicación no puede iniciarse sin un secreto JWT seguro.',
      );
    }
    // Este valor estuvo publicado en el repositorio como default de desarrollo.
    // Quien lo conozca puede firmar tokens válidos para cualquier usuario, así
    // que fuera de desarrollo se rechaza aunque esté configurado.
    if (
      process.env.NODE_ENV === 'production' &&
      secret === 'ferry-super-secret-key-cambiar-en-produccion'
    ) {
      throw new Error(
        'FATAL: JWT_SECRET tiene el valor de desarrollo que es público. ' +
        'Configura un secreto propio y aleatorio.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) throw new UnauthorizedException('Token inválido');
    return { uid: user.uid, email: user.email, role: user.role, displayName: user.displayName };
  }
}
