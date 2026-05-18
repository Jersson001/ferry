import React, { useEffect, useState } from 'react';
import { MaterialRequest, RequestStatus, UserRole } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Zap, DollarSign, Package, Users, Crown, ShieldAlert, Loader2 } from 'lucide-react';
import { getAdminUsersWithSubscriptions, adminAssignPlan, getSubscriptionPlans, SubscriptionPlan } from '../services/subscriptionService';

interface Props {
  requests: MaterialRequest[];
  onManualQuote: (reqId: string) => void;
}

export const AdminPanel: React.FC<Props> = ({ requests, onManualQuote }) => {
  const [activeTab, setActiveTab] = useState<'PEDIDOS' | 'USUARIOS'>('PEDIDOS');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [plansStore, setPlansStore] = useState<SubscriptionPlan[]>([]);
  const [plansContractor, setPlansContractor] = useState<SubscriptionPlan[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<any | null>(null);

  const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING_QUOTES);

  useEffect(() => {
    if (activeTab === 'USUARIOS') {
      loadUsers();
      getSubscriptionPlans('STORE').then(res => setPlansStore(res));
      getSubscriptionPlans('CONTRACTOR').then(res => setPlansContractor(res));
    }
  }, [activeTab]);

  const loadUsers = () => {
    setLoadingUsers(true);
    getAdminUsersWithSubscriptions()
      .then(res => setUsers(res))
      .catch(err => console.error(err))
      .finally(() => setLoadingUsers(false));
  };

  const handleAssignPlan = async (userId: string, planId: string) => {
    setAssigningId(userId);
    try {
      await adminAssignPlan(userId, planId);
      loadUsers();
      setSelectedUserForPlan(null);
    } catch (err: any) {
      alert(err.message || 'Error al asignar el plan');
    } finally {
      setAssigningId(null);
    }
  };

  const stats = [
    { label: 'Pedidos Hoy', value: requests.length, icon: Package, color: 'text-blue-500' },
    { label: 'Cotizados', value: requests.filter(r => r.status !== RequestStatus.PENDING_QUOTES).length, icon: Zap, color: 'text-orange-500' },
    { label: 'Ventas (COP)', value: '$1.2M', icon: DollarSign, color: 'text-green-500' },
  ];

  const chartData = [
    { name: 'Lun', orders: 4 }, { name: 'Mar', orders: 3 }, { name: 'Mie', orders: 8 },
    { name: 'Jue', orders: 6 }, { name: 'Vie', orders: 5 }, { name: 'Sab', orders: 9 },
    { name: 'Dom', orders: 2 },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header Hero Card */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 rounded-3xl shadow-2xl border border-slate-800/80 overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-56 h-56 bg-ferry-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3.5 py-1 rounded-full w-fit">
            <Crown className="w-4 h-4 text-yellow-400 animate-pulse" />
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Supervisión Central</span>
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white">Panel Administrativo</h2>
          <p className="text-slate-300 text-sm max-w-md leading-relaxed font-medium">
            Monitorea los pedidos en tiempo real de la ciudad, controla los usuarios y asigna suscripciones VIP instantáneamente.
          </p>
        </div>
      </div>

      {/* Premium Segmented Navigation Bar */}
      <div className="flex bg-slate-200/80 backdrop-blur-md p-1.5 rounded-2xl shadow-inner border border-slate-300/60 my-6">
        <button
          onClick={() => setActiveTab('PEDIDOS')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTab === 'PEDIDOS'
              ? 'bg-white text-slate-900 shadow-md scale-[1.01] ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Package className={`w-4 h-4 transition-colors ${activeTab === 'PEDIDOS' ? 'text-ferry-500' : 'text-slate-400'}`} />
          <span>Gestión de Pedidos</span>
        </button>

        <button
          onClick={() => setActiveTab('USUARIOS')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTab === 'USUARIOS'
              ? 'bg-white text-slate-900 shadow-md scale-[1.01] ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className={`w-4 h-4 transition-colors ${activeTab === 'USUARIOS' ? 'text-ferry-500' : 'text-slate-400'}`} />
          <span>Usuarios & Suscripciones</span>
        </button>
      </div>

      {/* PEDIDOS TAB */}
      {activeTab === 'PEDIDOS' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, i) => (
              <Card key={i} className="flex flex-col items-center justify-center p-4 shadow-md">
                <stat.icon className={`w-8 h-8 mb-2 ${stat.color}`} />
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{stat.label}</span>
              </Card>
            ))}
          </div>

          <Card className="shadow-md">
             <h3 className="text-xs font-black text-slate-500 mb-4 uppercase tracking-wider">Actividad Semanal</h3>
             <div className="h-56 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="orders" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 5 ? '#f97316' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
             </div>
          </Card>

          <div>
            <h3 className="text-xs font-black text-slate-500 mb-3 uppercase tracking-wider">Pendientes por Cotizar ({pendingRequests.length})</h3>
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <p className="text-slate-400 text-center py-8 font-medium">Todo al día. Buen trabajo.</p>
              ) : (
                pendingRequests.map(req => (
                  <Card key={req.id} className="flex flex-col gap-3 shadow-sm border-l-4 border-l-orange-500">
                    <div className="flex justify-between items-start">
                       <div>
                         <h4 className="font-bold text-slate-900 text-base">{req.title}</h4>
                         <p className="text-xs text-slate-500">{new Date(req.date).toLocaleString()}</p>
                       </div>
                       <Badge type="warning">Pendiente</Badge>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 font-medium">
                       {req.items.length} ítems: {req.items.slice(0, 3).map(i => i.name).join(', ')}...
                    </div>
                    <Button onClick={() => onManualQuote(req.id)} className="w-full font-bold" variant="secondary">
                       <Zap className="w-4 h-4" /> Auto-Cotizar (Simulación)
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* USUARIOS & SUSCRIPCIONES TAB */}
      {activeTab === 'USUARIOS' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <Card className="shadow-xl border-slate-200 p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  Gestión de Usuarios y Niveles de Plan
                </h3>
                <p className="text-xs text-slate-500 mt-1">Supervisa y asigna manualmente planes a ferreterías y contratistas.</p>
              </div>
              <Button onClick={loadUsers} variant="outline" className="text-xs font-bold">
                🔄 Recargar
              </Button>
            </div>

            {loadingUsers ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-ferry-500" />
                <p className="text-sm">Consultando base de datos...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-medium">
                No hay usuarios registrados en el sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th className="p-4 font-bold rounded-l-xl">Usuario</th>
                      <th className="p-4 font-bold">Rol</th>
                      <th className="p-4 font-bold">Plan Actual</th>
                      <th className="p-4 font-bold">Créditos</th>
                      <th className="p-4 font-bold rounded-r-xl">Acción Manual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-medium text-slate-900">
                          <div className="font-bold">{u.displayName || 'Usuario'}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="p-4">
                          <Badge type={u.role === 'STORE' ? 'warning' : u.role === 'ADMIN' ? 'success' : 'info'}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-4 font-bold text-slate-800">
                          {u.subscription?.plan?.name ? (
                            <span className="flex items-center gap-1 text-ferry-600">
                              <Crown className="w-4 h-4" /> {u.subscription.plan.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Gratuito por defecto</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          {u.subscription?.creditsBalance ?? 0}
                        </td>
                        <td className="p-4">
                          {u.role === 'ADMIN' ? (
                            <span className="text-xs text-slate-400 font-medium italic">Intocable (Dios)</span>
                          ) : selectedUserForPlan?.uid === u.uid ? (
                            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
                              <select
                                className="bg-white text-xs border border-slate-200 rounded-lg p-1.5 outline-none font-medium"
                                onChange={(e) => {
                                  if (e.target.value) handleAssignPlan(u.uid, e.target.value);
                                }}
                                defaultValue=""
                              >
                                <option value="" disabled>Selecciona un plan...</option>
                                {(u.role === 'STORE' ? plansStore : plansContractor).map(p => (
                                  <option key={p.id} value={p.id}>{p.name} (${p.priceInCents / 100} COP)</option>
                                ))}
                              </select>
                              <button onClick={() => setSelectedUserForPlan(null)} className="text-slate-400 hover:text-slate-600 text-xs px-1 font-bold">
                                ✕
                              </button>
                              {assigningId === u.uid && <Loader2 className="w-4 h-4 animate-spin text-ferry-500" />}
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() => setSelectedUserForPlan(u)}
                              className="text-xs py-1.5 px-3 font-bold shadow-sm"
                            >
                              Cambiar Plan
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
