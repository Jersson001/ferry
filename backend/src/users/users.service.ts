import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findOneByPhone(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ phoneNumber });
  }

  async findOne(uid: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ uid });
  }

  async findOneByVerificationToken(token: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ emailVerificationToken: token });
  }

  async findOneByResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ resetPasswordToken: token });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(uid: string, updates: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(uid, updates);
    return this.findOne(uid);
  }
}
