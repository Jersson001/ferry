import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
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
}
