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
