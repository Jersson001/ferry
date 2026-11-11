import { planVigente } from './plan-vigente';
import { SubscriptionStatus } from './entities/user-subscription.entity';

// El sello de verificada de una ferretería exige el plan con sello Y el RUT verificado en el RUES.
describe('planVigente — sello de verificada', () => {
  const AHORA = new Date('2026-11-11T12:00:00Z');
  const planProfesional = { name: 'Profesional', priceInCents: 9_900_000, targetRole: 'STORE', hasVerifiedBadge: true };
  const sub = (plan: object) => ({
    plan, status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-11-01T00:00:00Z'), currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
  });

  const sello = async (usuario: object, plan: object = planProfesional) => {
    const findOne = jest.fn().mockResolvedValueOnce(usuario).mockResolvedValueOnce(sub(plan));
    return (await planVigente({ findOne } as any, 'u1', AHORA)).verificado;
  };

  it('ferretería con plan con sello y RUT verificado: lleva el sello', async () => {
    expect(await sello({ uid: 'u1', role: 'STORE', rutVerificacion: { estado: 'VERIFICADO' } })).toBe(true);
  });

  it.each([undefined, null, { estado: 'NO_REGISTRADO' }, { estado: 'DV_INVALIDO' }, { estado: 'MATRICULA_INACTIVA' }, { estado: 'SIN_CONSULTA' }])(
    'ferretería con plan pero RUT %p: sin sello', async (rutVerificacion) => {
      expect(await sello({ uid: 'u1', role: 'STORE', rutVerificacion })).toBe(false);
    });

  it('ferretería con RUT verificado pero plan sin sello: sin sello', async () => {
    expect(await sello({ uid: 'u1', role: 'STORE', rutVerificacion: { estado: 'VERIFICADO' } }, { ...planProfesional, hasVerifiedBadge: false })).toBe(false);
  });

  it('el sello de los contratistas no depende del RUT', async () => {
    expect(await sello({ uid: 'u1', role: 'CONTRACTOR' }, { ...planProfesional, targetRole: 'CONTRACTOR' })).toBe(true);
  });
});
