import React from 'react';

// Si una pantalla falla al dibujarse, React la desmonta entera y queda en blanco. Esto la atrapa y muestra
// un aviso con la opción de volver a intentar, sin tumbar el resto de la app (encabezado y menú siguen).
export class ErrorDePantalla extends React.Component<{ children: React.ReactNode; clave?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Ferry] Error al mostrar la pantalla:', error, info.componentStack);
  }

  // Al cambiar de pantalla se intenta de nuevo.
  componentDidUpdate(prev: { clave?: string }) {
    if (prev.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6">
        <p className="font-bold text-slate-800">Algo falló al mostrar esta pantalla</p>
        <p className="text-sm text-slate-500 max-w-xs">Tus datos están bien. Intenta de nuevo; si sigue pasando, avísanos.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-ferry-500 text-white font-semibold rounded-xl hover:bg-ferry-600"
        >
          Recargar
        </button>
      </div>
    );
  }
}
