# Ferry

Plataforma que conecta constructores con ferreterías. El constructor arma una lista de materiales —escribiéndola, dictándola o subiendo una foto— y las ferreterías cercanas le responden con cotizaciones que puede comparar y pagar en línea.

## Stack

- **Backend:** NestJS 11 + PostgreSQL 15 (TypeORM), autenticación JWT.
- **Frontend:** React 18 + TypeScript, Vite y Tailwind CSS.
- **Servicios externos:** Gemini para interpretar las listas de materiales, Google Maps/Places para direcciones, Wompi para pagos y SMTP para los correos transaccionales.

## Arranque rápido

Requiere Node.js y Docker Desktop. Desde `ferry/`:

```bash
docker compose up -d db
```

```bash
cd backend && npm install && npm run start:dev
```

```bash
cd frontend && npm install && npm run dev
```

El frontend queda en `http://localhost:5173` y el backend en `http://localhost:3000`.

Antes de arrancar, copia `.env.example` a `.env` en `backend/` y en `frontend/`, y rellena los valores. Los `.env` reales no se versionan.

> Ni Nest ni Vite releen el `.env` en caliente: si cambias una variable, reinicia el proceso.

## Estructura

```
ferry/
├── backend/     API NestJS
├── frontend/    App React + Vite
└── uploads/     Archivos subidos (fotos de perfil, portafolio, catálogos)
```

El módulo Android vive aparte, en `app/`, en la raíz del repositorio.

## Documentación

[PROYECTO.md](PROYECTO.md) tiene el detalle: herramientas y para qué sirve cada una, configuración de los servicios externos y cómo diagnosticar sus errores, bitácora de cambios y deuda técnica conocida.
