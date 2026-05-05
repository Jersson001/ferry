import React from 'react';
import { MaterialRequest, RequestStatus } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Zap, DollarSign, Package } from 'lucide-react';

interface Props {
  requests: MaterialRequest[];
  onManualQuote: (reqId: string) => void;
}

export const AdminPanel: React.FC<Props> = ({ requests, onManualQuote }) => {
  const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING_QUOTES);

  const stats = [
    { label: 'Pedidos Hoy', value: requests.length, icon: Package, color: 'text-blue-500' },
    { label: 'Cotizados', value: requests.filter(r => r.status !== RequestStatus.PENDING_QUOTES).length, icon: Zap, color: 'text-orange-500' },
    { label: 'Ventas (COP)', value: '$1.2M', icon: DollarSign, color: 'text-green-500' },
  ];

  const chartData = [
    { name: 'Lun', orders: 4 },
    { name: 'Mar', orders: 3 },
    { name: 'Mie', orders: 8 },
    { name: 'Jue', orders: 6 },
    { name: 'Vie', orders: 5 },
    { name: 'Sab', orders: 9 },
    { name: 'Dom', orders: 2 },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-slate-900 text-white p-6 rounded-2xl">
        <h2 className="text-2xl font-bold">Modo Dios 🛠️</h2>
        <p className="text-slate-400">Control central de Ferry.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <Card key={i} className="flex flex-col items-center justify-center p-3">
            <stat.icon className={`w-6 h-6 mb-2 ${stat.color}`} />
            <span className="text-xl font-bold">{stat.value}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</span>
          </Card>
        ))}
      </div>

      <div className="h-48 w-full">
         <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Actividad Semanal</h3>
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 5 ? '#ea580c' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
         </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Pendientes por Cotizar ({pendingRequests.length})</h3>
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-slate-400 text-center py-4">Todo al día. Buen trabajo.</p>
          ) : (
            pendingRequests.map(req => (
              <Card key={req.id} className="flex flex-col gap-3">
                <div className="flex justify-between items-start">
                   <div>
                     <h4 className="font-bold text-slate-800">{req.title}</h4>
                     <p className="text-xs text-slate-500">{new Date(req.date).toLocaleString()}</p>
                   </div>
                   <Badge type="warning">Pendiente</Badge>
                </div>
                <div className="bg-slate-50 p-2 rounded text-sm text-slate-600">
                   {req.items.length} ítems: {req.items.slice(0, 2).map(i => i.name).join(', ')}...
                </div>
                <Button onClick={() => onManualQuote(req.id)} className="w-full" variant="secondary">
                   <Zap className="w-4 h-4" /> Auto-Cotizar (Simulación)
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
