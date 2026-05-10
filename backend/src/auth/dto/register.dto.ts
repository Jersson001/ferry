import { IsEmail, IsString, MinLength, IsIn, Matches, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/[A-Z]/, { message: 'La contraseña debe tener al menos una letra mayúscula' })
  @Matches(/[0-9]/, { message: 'La contraseña debe tener al menos un número' })
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsIn(['USER', 'STORE'], { message: 'El rol debe ser USER o STORE' })
  role: string;
}
