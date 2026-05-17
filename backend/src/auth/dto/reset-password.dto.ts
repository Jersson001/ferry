import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'La contraseña debe tener al menos una letra mayúscula' })
  @Matches(/[0-9]/, { message: 'La contraseña debe tener al menos un número' })
  password: string;
}
