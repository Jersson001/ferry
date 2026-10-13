import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionStatus } from './entities/user-subscription.entity';

const planGratis = { id: 'gratis', name: 'Gratuito', priceInCents: 0, credits: 5 };
const planDePago = { id: 'elite', name: 'Distribuidor Elite', priceInCents: 20000000, credits: 9999 };

const armar = (suscripcionActual: { status: SubscriptionStatus } = { status: SubscriptionStatus.INACTIVE }) => {
  const service: any = {
    getPlans: jest.fn(async () => [planGratis, planDePago]),
    getUserSubscription: jest.fn(async () => suscripcionActual),
    purchasePlan: jest.fn(async () => ({ status: SubscriptionStatus.ACTIVE })),
  };
  return { controller: new SubscriptionsController(service, {} as any), service };
};

const peticion = { user: { uid: 'u1', email: 'a@b.com', role: 'STORE' } } as any;

describe('POST /subscriptions/purchase/:planId — no verifica pagos', () => {
  it('un plan de pago no se activa por esta ruta: lo activa el pago verificado de Wompi', async () => {
    const { controller, service } = armar();
    await expect(controller.purchasePlan('elite', peticion)).rejects.toThrow(ForbiddenException);
    expect(service.purchasePlan).not.toHaveBeenCalled();
  });

  it('un plan que no existe da 404', async () => {
    const { controller } = armar();
    await expect(controller.purchasePlan('inventado', peticion)).rejects.toThrow(NotFoundException);
  });

  it('el plan gratuito se activa una vez', async () => {
    const { controller, service } = armar();
    await controller.purchasePlan('gratis', peticion);
    expect(service.purchasePlan).toHaveBeenCalledWith('u1', 'gratis');
  });

  it('con un plan ya activo no se vuelve a activar otro por esta ruta, para no sumar créditos', async () => {
    const { controller, service } = armar({ status: SubscriptionStatus.ACTIVE });
    await controller.purchasePlan('gratis', peticion);
    expect(service.purchasePlan).not.toHaveBeenCalled();
  });
});
