import { Injectable } from '@nestjs/common';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { User } from '../users/user.entity';
import { MaterialRequest } from '../quotes/entities/material-request.entity';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity';
import { ProjectApplication } from '../projects/entities/project-application.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { CatalogVisit } from '../stores/entities/catalog-visit.entity';
import { haceDias, num, promedio, ResumenAdmin } from './admin-stats';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly dataSource: DataSource,
  ) {}

  async getUsersWithSubscriptions() {
    const users = await this.usersService.findAll();
    const result: any[] = [];
    for (const u of users) {
      const sub = await this.subscriptionsService.getUserSubscription(u.uid);
      result.push({
        uid: u.uid,
        email: u.email || 'Sin correo',
        displayName: u.displayName,
        role: u.role,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
        subscription: sub ? {
          status: sub.status,
          creditsBalance: sub.creditsBalance,
          currentPeriodEnd: sub.currentPeriodEnd,
          plan: sub.plan ? {
            id: sub.plan.id,
            name: sub.plan.name,
            priceInCents: sub.plan.priceInCents,
            maxPortfolioItems: sub.plan.maxPortfolioItems,
            maxLeadsOrApplications: sub.plan.maxLeadsOrApplications,
          } : null,
        } : null,
      });
    }
    return result;
  }

  async assignPlan(userId: string, planId: string) {
    return this.subscriptionsService.purchasePlan(userId, planId);
  }

  // Números del día a día para el inicio del panel. Cada consulta es un conteo simple.
  async getResumen(): Promise<ResumenAdmin> {
    const semana = haceDias(7);
    const usuarios = this.dataSource.getRepository(User);
    const visitas = this.dataSource.getRepository(CatalogVisit);
    const quotes = this.dataSource.getRepository(Quote);

    const [total, tiendas, nuevos7d, solicitudes, solicitudes7d, entregados, referidos, visitas7d, porQr7d, califs, masVistas] =
      await Promise.all([
        usuarios.count(),
        usuarios.count({ where: { role: 'STORE' as any } }),
        usuarios.count({ where: { createdAt: MoreThanOrEqual(semana) } }),
        this.dataSource.getRepository(MaterialRequest).count(),
        this.dataSource.getRepository(MaterialRequest).count({ where: { createdAt: MoreThanOrEqual(semana) } }),
        quotes.count({ where: { status: QuoteStatus.DELIVERED } }),
        this.dataSource.getRepository(Referral).count(),
        visitas.count({ where: { createdAt: MoreThanOrEqual(semana) } }),
        visitas.count({ where: { createdAt: MoreThanOrEqual(semana), via: 'qr' } }),
        quotes
          .createQueryBuilder('q')
          .select('COUNT(q.rating)', 'total')
          .addSelect('SUM(CASE WHEN q.reviewHidden THEN 1 ELSE 0 END)', 'ocultas')
          .addSelect('COUNT(CASE WHEN q.reviewHidden = false THEN 1 END)', 'visibles')
          .addSelect('SUM(CASE WHEN q.reviewHidden = false THEN q.rating ELSE 0 END)', 'sumaVisibles')
          .where('q.rating BETWEEN 1 AND 5')
          .getRawOne(),
        visitas
          .createQueryBuilder('v')
          .innerJoin(User, 's', 's.uid = v.storeId')
          .select('v.storeId', 'storeId')
          .addSelect('s.displayName', 'name')
          .addSelect('COUNT(*)', 'visitas')
          .where('v.createdAt >= :semana', { semana })
          .groupBy('v.storeId')
          .addGroupBy('s.displayName')
          .orderBy('COUNT(*)', 'DESC')
          .limit(5)
          .getRawMany(),
      ]);

    return {
      usuarios: { total, tiendas, clientes: total - tiendas, nuevos7d },
      solicitudes: { total: solicitudes, nuevas7d: solicitudes7d },
      pedidosEntregados: entregados,
      opiniones: { total: num(califs?.total), ocultas: num(califs?.ocultas), promedio: promedio(califs?.sumaVisibles, califs?.visibles) },
      referidos,
      catalogo: {
        visitas7d,
        porQr7d,
        masVistas: masVistas.map((m: any) => ({ storeId: m.storeId, name: m.name || 'Ferretería', visitas: num(m.visitas) })),
      },
    };
  }

  // Todas las opiniones, también las ocultas, para que el administrador decida cuáles esconder.
  async getOpiniones(limite: number) {
    const filas = await this.dataSource
      .getRepository(Quote)
      .createQueryBuilder('q')
      .innerJoin('q.store', 's')
      .innerJoin('q.request', 'r')
      .innerJoin('r.user', 'u')
      .select('q.id', 'id')
      .addSelect('q.rating', 'rating')
      .addSelect('q.reviewComment', 'comment')
      .addSelect('q.reviewReply', 'reply')
      .addSelect('q.reviewHidden', 'hidden')
      .addSelect('q.reviewedAt', 'date')
      .addSelect('s.displayName', 'store')
      .addSelect('u.displayName', 'client')
      .where('q.rating BETWEEN 1 AND 5')
      .orderBy('q.reviewedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('q.createdAt', 'DESC')
      .limit(limite)
      .getRawMany();
    const deContratistas = await this.dataSource
      .getRepository(ProjectApplication)
      .createQueryBuilder('a')
      .innerJoin('a.contractor', 'c')
      .innerJoin('a.project', 'p')
      .innerJoin(User, 'u', 'u.uid = p.userId')
      .select('a.id', 'id')
      .addSelect('a.rating', 'rating')
      .addSelect('a.reviewComment', 'comment')
      .addSelect('a.reviewReply', 'reply')
      .addSelect('a.reviewHidden', 'hidden')
      .addSelect('a.reviewedAt', 'date')
      .addSelect('c.displayName', 'store')
      .addSelect('u.displayName', 'client')
      .where('a.rating BETWEEN 1 AND 5')
      .orderBy('a.reviewedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('a.createdAt', 'DESC')
      .limit(limite)
      .getRawMany();
    const aItem = (kind: 'tienda' | 'contratista') => (f: any) => ({
      kind,
      id: f.id,
      rating: num(f.rating),
      comment: f.comment ?? '',
      reply: f.reply ?? null,
      hidden: Boolean(f.hidden),
      date: f.date ?? null,
      store: f.store || (kind === 'tienda' ? 'Ferretería' : 'Profesional'),
      client: f.client || 'Cliente',
    });
    const todas = [...filas.map(aItem('tienda')), ...deContratistas.map(aItem('contratista'))];
    todas.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    return todas.slice(0, limite);
  }
}
