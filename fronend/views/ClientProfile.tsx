
import React from 'react';
import { Button, Card, Badge } from '../components/UIComponents';
import { User, MapPin, CreditCard, Bell, Shield, LogOut, ChevronRight, HelpCircle } from 'lucide-react';

export const ClientProfile: React.FC = () => {
  return (
    <div className="space-y-6 pb-20 animate-in slide-in-from-right-4">
      {/* Header Profile */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-16 h-16 bg-ferry-100 rounded-full flex items-center justify-center text-ferry-600 border-2 border-white shadow-md">
            <User className="w-8 h-8" />
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-800">Juan Pérez</h2>
            <div className="flex items-center gap-2 mt-1">
                <Badge type="info">Nivel: Constructor</Badge>
                <span className="text-xs text-slate-400">Miembro desde 2023</span>
            </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
            <span className="block font-bold text-xl text-ferry-600">12</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">Pedidos</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
            <span className="block font-bold text-xl text-slate-700">5</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">Proyectos</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
            <span className="block font-bold text-xl text-slate-700">4.9</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">Calif.</span>
        </div>
      </div>

      {/* Menu Options */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-500 uppercase ml-1 mb-2">Mi Cuenta</h3>
        
        <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><MapPin className="w-5 h-5"/></div>
                <span className="font-semibold text-slate-700">Mis Direcciones</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>

        <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><CreditCard className="w-5 h-5"/></div>
                <span className="font-semibold text-slate-700">Métodos de Pago</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>

        <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Bell className="w-5 h-5"/></div>
                <span className="font-semibold text-slate-700">Notificaciones</span>
            </div>
            <div className="w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">2</div>
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-500 uppercase ml-1 mb-2">Soporte y Legal</h3>

        <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-600"><HelpCircle className="w-5 h-5"/></div>
                <span className="font-semibold text-slate-700">Ayuda en Línea</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>

        <button className="w-full bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg text-green-600"><Shield className="w-5 h-5"/></div>
                <span className="font-semibold text-slate-700">Términos y Privacidad</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 mt-4">
        <LogOut className="w-5 h-5 mr-2" /> Cerrar Sesión
      </Button>
    </div>
  );
};
