import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralCode } from './entities/referral.entity';
import { User } from '../users/user.entity';
import { estaEnPlazo, generarCodigo, limpiarNombre, normalizarCodigo } from './referidos';

export interface FilaCodigo {
  code: string;
  name: string;
  active: boolean;
  createdAt: Date;
  total: number;
  tiendas: number;
  clientes: number;
}

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(ReferralCode) private codes: Repository<ReferralCode>,
    @InjectRepository(Referral) private referrals: Repository<Referral>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  // La llama la app de quien acaba de registrarse. No dice por qué falló: el código es un dato del admin
  // y no debe servir para averiguar cuáles existen.
  async reclamar(userId: string, codigoCrudo: unknown): Promise<{ attributed: boolean }> {
    const code = normalizarCodigo(codigoCrudo);
    if (!code) return { attributed: false };

    const [codigo, usuario, previo] = await Promise.all([
      this.codes.findOne({ where: { code } }),
      this.users.findOne({ where: { uid: userId }, select: ['uid', 'role', 'createdAt'] }),
      this.referrals.findOne({ where: { userId } }),
    ]);
    if (!codigo || !codigo.active || !usuario || previo) return { attributed: false };
    if (usuario.role === 'ADMIN' || !estaEnPlazo(usuario.createdAt)) return { attributed: false };

    try {
      await this.referrals.insert({ userId, code });
      return { attributed: true };
    } catch {
      // Dos reclamos a la vez: gana el primero, la clave primaria evita el segundo.
      return { attributed: false };
    }
  }

  async crear(codigoCrudo: unknown, nombreCrudo: unknown): Promise<ReferralCode> {
    const name = limpiarNombre(nombreCrudo);
    if (!name) throw new BadRequestException('Escribe a quién pertenece el código');

    const pedido = codigoCrudo === undefined || codigoCrudo === null || String(codigoCrudo).trim() === '';
    if (!pedido) {
      const code = normalizarCodigo(codigoCrudo);
      if (!code) throw new BadRequestException('El código lleva de 3 a 20 letras o números, sin espacios');
      if (await this.codes.findOne({ where: { code } })) throw new ConflictException('Ese código ya existe');
      return this.codes.save(this.codes.create({ code, name }));
    }

    for (let intento = 0; intento < 8; intento++) {
      const code = generarCodigo();
      if (!(await this.codes.findOne({ where: { code } }))) return this.codes.save(this.codes.create({ code, name }));
    }
    throw new ConflictException('No se pudo generar un código libre, intenta de nuevo');
  }

  async activar(codigoCrudo: string, active: boolean): Promise<{ code: string; active: boolean }> {
    const code = normalizarCodigo(codigoCrudo);
    const fila = code ? await this.codes.findOne({ where: { code } }) : null;
    if (!fila) throw new NotFoundException('Código no encontrado');
    fila.active = active;
    await this.codes.save(fila);
    return { code: fila.code, active };
  }

  // Cada código con cuántas cuentas trajo, separadas en ferreterías y clientes.
  async listar(): Promise<FilaCodigo[]> {
    const [codigos, conteos] = await Promise.all([
      this.codes.find({ order: { createdAt: 'DESC' } }),
      this.referrals
        .createQueryBuilder('r')
        .innerJoin(User, 'u', 'u.uid = r.userId')
        .select('r.code', 'code')
        .addSelect('COUNT(*)', 'total')
        .addSelect(`SUM(CASE WHEN u.role = 'STORE' THEN 1 ELSE 0 END)`, 'tiendas')
        .addSelect(`SUM(CASE WHEN u.role <> 'STORE' THEN 1 ELSE 0 END)`, 'clientes')
        .groupBy('r.code')
        .getRawMany<{ code: string; total: string; tiendas: string; clientes: string }>(),
    ]);
    const porCodigo = new Map(conteos.map(c => [c.code, c]));
    return codigos.map(c => {
      const n = porCodigo.get(c.code);
      return {
        code: c.code,
        name: c.name,
        active: c.active,
        createdAt: c.createdAt,
        total: Number(n?.total ?? 0),
        tiendas: Number(n?.tiendas ?? 0),
        clientes: Number(n?.clientes ?? 0),
      };
    });
  }
}
