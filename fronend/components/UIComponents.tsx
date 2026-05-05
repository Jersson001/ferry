import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost', isLoading?: boolean }> = ({ 
  children, variant = 'primary', className = '', isLoading, ...props 
}) => {
  const baseStyle = "px-4 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95";
  const variants = {
    primary: "bg-ferry-600 text-white shadow-lg shadow-ferry-500/30 hover:bg-ferry-700",
    secondary: "bg-slate-800 text-white hover:bg-slate-900",
    outline: "border-2 border-slate-200 text-slate-700 hover:border-ferry-500 hover:text-ferry-600",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`} disabled={isLoading} {...props}>
      {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
    {children}
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode, type?: 'success' | 'warning' | 'info' | 'neutral' }> = ({ children, type = 'neutral' }) => {
  const styles = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-orange-100 text-orange-700',
    info: 'bg-blue-100 text-blue-700',
    neutral: 'bg-slate-100 text-slate-600'
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[type]}`}>
      {children}
    </span>
  );
};

export const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  return (
    <div className="flex text-yellow-400 text-sm">
      {[...Array(5)].map((_, i) => (
        <span key={i}>{i < rating ? "★" : "☆"}</span>
      ))}
    </div>
  );
};
