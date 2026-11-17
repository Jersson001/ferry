// Rol real de la cuenta, leído del token que firmó el servidor ({ sub, email, role }).
// El perfil en memoria no sirve para esto: al cargar la sesión convierte ADMIN en USER, y el botón
// Usuario/Tienda/Admin de los administradores cambia solo la vista. Es para decidir qué mostrar;
// los permisos de verdad los aplica el backend.
export const rolDeLaSesion = (): string | null => {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
};
