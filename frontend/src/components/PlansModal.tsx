import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from './UIComponents';
import { Check, Star, Zap, Shield, Crown, X, ArrowRight, Loader2 } from 'lucide-react';
import { getSubscriptionPlans, purchasePlan, SubscriptionPlan, UserSubscription } from '../services/subscriptionService';
import { UserRole } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  currentSubscription: UserSubscription | null;
  onPlanUpdated: (newSub: UserSubscription) => void;
}

export const PlansModal: React.FC<Props> = ({ isOpen, onClose, userRole, currentSubscription, onPlanUpdated }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    // Filtrar por el rol actual
    const target = userRole === UserRole.STORE ? 'STORE' : 'CONTRACTOR';
    getSubscriptionPlans(target)
      .then(res => setPlans(res))
      .catch(err => setError(err.message || 'Error al cargar los planes'))
      .finally(() => setLoading(false));
  }, [isOpen, userRole]);

  if (!isOpen) return null;

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (currentSubscription?.plan?.id === plan.id) return;
    setPurchasingId(plan.id);
    setError(null);
    try {
      const updated = await purchasePlan(plan.id);
      onPlanUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la mejora');
    } finally {
      setPurchasingId(null);
    }
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Gratis';
    const pesos = cents / 100;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(pesos);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="bg-ferry-500 p-8 text-white relative flex-shrink-0 shadow-md">
          <button onClick={onClose} className="absolute top-6 right-6 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-yellow-300 text-xs font-black tracking-widest uppercase mb-2">
            <Crown className="w-4 h-4" /> Planes de {userRole === UserRole.STORE ? 'Ferreterías & Tiendas' : 'Contratistas & Maestros'}
          </div>
          <h2 className="text-3xl font-black tracking-tight">Desbloquea tu Máximo Potencial</h2>
          <p className="text-slate-100 text-sm mt-2 max-w-xl font-medium">
            {userRole === UserRole.STORE 
              ? 'Recibe leads calificados de cotizaciones en tu zona, destaca tus productos y aumenta las ventas de tu ferretería.'
              : 'Sube fotos a tu portafolio, accede a postulaciones exclusivas y recibe notificaciones de proyectos en tu zona.'}
          </p>
        </div>

        {/* Body / Cards */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-50">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl font-medium text-sm mb-6 flex items-center gap-2">
              <span>⚠️ {error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-ferry-500" />
              <p>Cargando planes oficiales...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => {
                const isCurrent = currentSubscription?.plan?.id === plan.id || (!currentSubscription?.plan && plan.priceInCents === 0);
                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl border-2 transition-all flex flex-col p-6 relative ${
                      isCurrent
                        ? 'border-green-500 bg-green-50/40 shadow-md ring-4 ring-green-500/10'
                        : plan.isPopular
                        ? 'border-ferry-500 bg-white shadow-2xl scale-105 z-10 ring-4 ring-ferry-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    {plan.isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-ferry-500 to-orange-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                        Más Popular
                      </span>
                    )}

                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                        Tu Plan Actual
                      </span>
                    )}

                    <div className="mb-4">
                      <h3 className="text-xl font-black text-slate-900 flex items-center justify-between">
                        {plan.name}
                        {plan.hasVerifiedBadge && <Shield className="w-5 h-5 text-blue-500 fill-blue-100" />}
                      </h3>
                      <div className="mt-2 flex items-baseline flex-wrap gap-x-1">
                        <span className="text-2xl font-black text-slate-900 leading-tight">{formatPrice(plan.priceInCents)}</span>
                        {plan.priceInCents > 0 && <span className="text-xs text-slate-500 font-bold self-end">/mes</span>}
                      </div>
                    </div>

                    <hr className="border-slate-100 my-4" />

                    {/* Features list */}
                    <div className="space-y-3 flex-1 text-sm text-slate-700 font-medium mb-6">
                      {userRole !== UserRole.STORE && (
                        <div className="flex items-center gap-2 text-slate-900 font-bold">
                          <Check className="w-4 h-4 text-ferry-500 shrink-0" />
                          <span>{plan.maxPortfolioItems === -1 || plan.maxPortfolioItems >= 999 ? 'Fotos ilimitadas en portafolio' : `Hasta ${plan.maxPortfolioItems ?? 6} fotos en galería`}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-900 font-bold">
                        <Check className="w-4 h-4 text-ferry-500 shrink-0" />
                        <span>{plan.maxLeadsOrApplications === -1 || plan.maxLeadsOrApplications >= 999 ? (userRole === UserRole.STORE ? 'Leads ilimitados/mes' : 'Postulaciones ilimitadas') : `${plan.maxLeadsOrApplications ?? 10} ${userRole === UserRole.STORE ? 'leads calificados/mes' : 'postulaciones/mes'}`}</span>
                      </div>
                      
                      {plan.features && plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700">
                          <Check className="w-4 h-4 text-ferry-500 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100">
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isCurrent || purchasingId === plan.id}
                        className="w-full justify-center shadow-md font-black py-3 text-sm tracking-wide"
                        variant={isCurrent ? 'secondary' : plan.isPopular ? 'primary' : 'secondary'}
                      >
                        {purchasingId === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Activando...
                          </>
                        ) : isCurrent ? (
                          'Plan Activo'
                        ) : (
                          <>
                            Seleccionar Plan <ArrowRight className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-center text-slate-400 mt-2 font-bold uppercase tracking-wider">Activación simulada instantánea</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
