import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;
}
