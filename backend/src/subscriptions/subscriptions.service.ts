import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription, SubscriptionStatus } from './entities/user-subscription.entity';
import { CreditLedger, LedgerType } from './entities/credit-ledger.entity';
import { UsageLog } from './entities/usage-log.entity';
import { planVigente, usoDesde, quedaCupo, precioContacto, mensajeSinCupo } from './plan-vigente';
import { PLANES_USUARIO } from './planes-usuario';
import { PLANES_TIENDA } from './planes-tienda';

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

  async getPlans(role?: string): Promise<SubscriptionPlan[]> {
    const where = role ? { targetRole: role } : {};
    return this.planRepository.find({ where, order: { priceInCents: 'ASC' } });
  }

  async getUserSubscription(userId: string): Promise<UserSubscription> {
    let sub = await this.userSubRepository.findOne({
      where: { userId },
      relations: ['plan'],
    });

    if (!sub) {
      const newSub = this.userSubRepository.create({
        userId,
        status: SubscriptionStatus.INACTIVE,
        creditsBalance: 0,
      });
      await this.userSubRepository.save(newSub);
      // Recargar con relaciones
      sub = await this.userSubRepository.findOne({
        where: { userId },
        relations: ['plan'],
      });
    }
    return sub!;
  }

  /**
   * Retorna el límite de ítems de portafolio para un usuario.
   * Si no tiene plan activo, se usa el límite del plan Gratuito (6).
   */
  async getPortfolioLimit(userId: string): Promise<number> {
    const sub = await this.getUserSubscription(userId);
    if (sub?.plan?.maxPortfolioItems !== undefined) {
      return sub.plan.maxPortfolioItems;
    }
    return 6; // Default plan Gratuito
  }

  async getLedger(userId: string): Promise<CreditLedger[]> {
    return this.ledgerRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async purchasePlan(userId: string, planId: string): Promise<UserSubscription> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let sub = await queryRunner.manager.findOne(UserSubscription, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sub) {
        sub = queryRunner.manager.create(UserSubscription, { userId, creditsBalance: 0 });
      }

      sub.planId = plan.id;
      sub.status = SubscriptionStatus.ACTIVE;
      sub.creditsBalance += plan.credits;

      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = nextMonth;

      await queryRunner.manager.save(sub);

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

  /**
   * Descuenta créditos. Si recibe `manager`, corre dentro de esa transacción (quien llama la confirma
   * o la revierte); si no, abre y confirma la suya.
   */
  async deductCredits(userId: string, amount: number, reference: string, manager?: EntityManager): Promise<void> {
    if (manager) return this.descontar(manager, userId, amount, reference);
    await this.dataSource.transaction(m => this.descontar(m, userId, amount, reference));
  }

  private async descontar(manager: EntityManager, userId: string, amount: number, reference: string): Promise<void> {
    const sub = await manager.findOne(UserSubscription, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!sub || sub.creditsBalance < amount) {
      throw new BadRequestException('Créditos insuficientes para realizar esta acción');
    }

    sub.creditsBalance -= amount;
    await manager.save(sub);

    const ledgerEntry = manager.create(CreditLedger, {
      userId,
      type: LedgerType.SPENT,
      amount,
      reference,
    });
    await manager.save(ledgerEntry);
  }

  /**
   * Pobla la base de datos con los planes oficiales del modelo de negocio Ferry.
   * Solo se ejecuta si la tabla está vacía (auto-seeding al iniciar).
   */
  async seedPlans() {
    // Siembra idempotente: solo ejecutar si la tabla está vacía
    const count = await this.planRepository.count();
    if (count > 0) {
      return; // Ya existen planes, no tocar nada
    }

    await this.planRepository.save([
      // ─── SEGMENTO: FERRETERÍAS Y TIENDAS ───────────────────────────────
      ...PLANES_TIENDA.map(({ nombresAnteriores, ...plan }) => plan),

      // ─── SEGMENTO: CONTRATISTAS Y PROFESIONALES ────────────────────────
      ...PLANES_USUARIO.map(({ nombresAnteriores, ...plan }) => plan),
    ]);
  }

  /**
   * Deja los planes de usuario y de ferretería como dicen PLANES_USUARIO y PLANES_TIENDA. Corre en cada
   * arranque: seedPlans solo siembra con la tabla vacía, y así los cambios de precios y cupos llegan a
   * producción. Busca cada plan por su segmento y su nombre actual o uno anterior, para conservar su id y
   * las suscripciones.
   */
  async sincronizarPlanes(): Promise<void> {
    const existentes = await this.planRepository.find();
    for (const { nombresAnteriores, ...def } of [...PLANES_USUARIO, ...PLANES_TIENDA]) {
      const nombres = [def.name, ...nombresAnteriores];
      const plan = existentes.find(p => p.targetRole === def.targetRole && nombres.includes(p.name));
      await this.planRepository.save(plan ? Object.assign(plan, def) : this.planRepository.create(def));
    }
  }

  // Plan vigente y cuánto lleva gastado de cada cupo este mes.
  async getUso(userId: string) {
    const plan = await planVigente(this.dataSource.manager, userId);
    const usados = await usoDesde(this.dataSource.manager, userId, plan.inicio);
    return { ...plan, usados, precioContactoInCents: precioContacto(plan) };
  }

  // Antes de una lectura de IA: corta si ya no le quedan en el mes.
  async verificarCupoIa(userId: string): Promise<void> {
    const plan = await planVigente(this.dataSource.manager, userId);
    const { transcripcionesIa } = await usoDesde(this.dataSource.manager, userId, plan.inicio);
    if (!quedaCupo(plan.limites.transcripcionesIa, transcripcionesIa)) {
      throw new ForbiddenException(mensajeSinCupo(plan, 'transcripciones de IA', plan.limites.transcripcionesIa));
    }
  }

  // Después de una lectura de IA exitosa.
  async registrarUsoIa(userId: string): Promise<void> {
    await this.dataSource.getRepository(UsageLog).save({ userId, kind: 'AI' });
  }
}
