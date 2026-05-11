import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription, SubscriptionStatus } from './entities/user-subscription.entity';
import { CreditLedger, LedgerType } from './entities/credit-ledger.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(UserSubscription)
    private userSubRepository: Repository<UserSubscription>,
    @InjectRepository(CreditLedger)
    private ledgerRepository: Repository<CreditLedger>,
    private dataSource: DataSource,
  ) {}

  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.planRepository.find({ order: { priceInCents: 'ASC' } });
  }

  async getUserSubscription(userId: string): Promise<UserSubscription> {
    let sub = await this.userSubRepository.findOne({ 
      where: { userId },
      relations: ['plan'] 
    });

    if (!sub) {
      sub = this.userSubRepository.create({
        userId,
        status: SubscriptionStatus.INACTIVE,
        creditsBalance: 0,
      });
      await this.userSubRepository.save(sub);
    }
    return sub;
  }

  async getLedger(userId: string): Promise<CreditLedger[]> {
    return this.ledgerRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // Simulación de compra para el MVP (En producción se engancha con el webhook de Wompi)
  async purchasePlan(userId: string, planId: string): Promise<UserSubscription> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Bloquear o crear la suscripción
      let sub = await queryRunner.manager.findOne(UserSubscription, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sub) {
        sub = queryRunner.manager.create(UserSubscription, { userId, creditsBalance: 0 });
      }

      // 2. Actualizar la suscripción
      sub.planId = plan.id;
      sub.status = SubscriptionStatus.ACTIVE;
      sub.creditsBalance += plan.credits; // Acumular
      
      // Añadir 30 días al periodo
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      sub.currentPeriodEnd = nextMonth;

      await queryRunner.manager.save(sub);

      // 3. Crear el registro inmutable en el Ledger
      const ledgerEntry = queryRunner.manager.create(CreditLedger, {
        userId,
        type: LedgerType.EARNED,
        amount: plan.credits,
        reference: `PURCHASE-${plan.name}`,
      });
      await queryRunner.manager.save(ledgerEntry);

      await queryRunner.commitTransaction();
      return sub;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Método usado internamente cuando un contratista aplica a un proyecto (Módulo B-8)
  async deductCredits(userId: string, amount: number, reference: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sub = await queryRunner.manager.findOne(UserSubscription, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sub || sub.creditsBalance < amount) {
        throw new BadRequestException('Créditos insuficientes para realizar esta acción');
      }

      // Descontar
      sub.creditsBalance -= amount;
      await queryRunner.manager.save(sub);

      // Registrar
      const ledgerEntry = queryRunner.manager.create(CreditLedger, {
        userId,
        type: LedgerType.SPENT,
        amount,
        reference,
      });
      await queryRunner.manager.save(ledgerEntry);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Utilidad de seeding para crear planes por defecto si no existen
  async seedPlans() {
    const count = await this.planRepository.count();
    if (count === 0) {
      await this.planRepository.save([
        { name: 'Gratis', priceInCents: 0, credits: 3, isPopular: false, features: ['3 Aplicaciones/mes', 'Perfil Básico'] },
        { name: 'Pro', priceInCents: 2990000, credits: 20, isPopular: true, features: ['20 Aplicaciones/mes', 'Destacado', 'Soporte'] },
      ]);
    }
  }
}
