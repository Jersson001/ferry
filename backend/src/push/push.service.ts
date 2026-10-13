import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { User } from '../users/user.entity';
import { MaterialRequest } from '../quotes/entities/material-request.entity';
import { categoriasDeLaTienda } from '../users/perfil';
import { estaEnRadio, leerUbicacion } from '../quotes/ubicacion';
import { textoDeAviso } from './avisos';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly habilitado: boolean;
  readonly clavePublica: string;

  constructor(
    @InjectRepository(PushSubscriptionEntity) private subs: Repository<PushSubscriptionEntity>,
    @InjectRepository(User) private users: Repository<User>,
  ) {
    const publica = process.env.VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;
    this.clavePublica = publica ?? '';
    this.habilitado = !!(publica && privada);
    if (this.habilitado) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:soporte@ferryapp.co', publica!, privada!);
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no están definidas: las notificaciones push quedan apagadas.');
    }
  }

  async guardar(userId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
    const existente = await this.subs.findOne({ where: { endpoint: sub.endpoint } });
    // El mismo navegador puede cambiar de cuenta: la suscripción pasa a la cuenta actual.
    await this.subs.save(existente ? { ...existente, ...sub, userId } : this.subs.create({ ...sub, userId }));
  }

  async quitar(userId: string, endpoint: string): Promise<void> {
    await this.subs.delete({ userId, endpoint });
  }

  // Avisa a las ferreterías de la categoría que quedan dentro del radio. Nunca debe romper la creación de la solicitud.
  async avisarSolicitud(request: MaterialRequest): Promise<number> {
    if (!this.habilitado) return 0;
    try {
      const tiendas = await this.users.find({ where: { role: 'STORE' as any }, select: ['uid', 'specialties', 'location'] });
      const obra = leerUbicacion(request);
      const destino = tiendas.filter(t =>
        categoriasDeLaTienda(t.specialties).includes(request.category) &&
        estaEnRadio(leerUbicacion({ userLocation: t.location }), obra, request.radioKm ?? 10),
      );
      if (destino.length === 0) return 0;
      const suscripciones = await this.subs.find({ where: { userId: In(destino.map(t => t.uid)) } });
      let enviados = 0;
      await Promise.all(suscripciones.map(async (s) => {
        const tienda = destino.find(t => t.uid === s.userId)!;
        const aviso = textoDeAviso(request.category, leerUbicacion({ userLocation: tienda.location }), obra);
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...aviso, url: '/' }),
            { TTL: 60 * 60 * 6 },
          );
          enviados++;
        } catch (err: any) {
          // 404/410: el navegador ya no existe o el permiso se retiró; se limpia para no insistir.
          if (err?.statusCode === 404 || err?.statusCode === 410) await this.subs.delete({ id: s.id });
          else this.logger.warn(`No se pudo enviar un aviso (${err?.statusCode ?? err?.message})`);
        }
      }));
      return enviados;
    } catch (err: any) {
      this.logger.error(`Fallo al avisar la solicitud ${request.id}: ${err?.message}`);
      return 0;
    }
  }
}
