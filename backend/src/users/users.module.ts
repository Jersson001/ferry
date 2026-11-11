import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { VerificadorRutService } from './verificador-rut.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, VerificadorRutService],
  controllers: [UsersController],
  exports: [UsersService, VerificadorRutService],
})
export class UsersModule {}
