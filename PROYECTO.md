# Ferry 2.0

Plataforma que conecta constructores con ferreterías: el constructor publica una lista de materiales y las ferreterías cercanas le envían cotizaciones.

Documento de referencia del proyecto: stack, cómo levantarlo en local, estado de los servicios externos y bitácora de cambios.

---

## Stack

### Backend — `ferry/backend`

| Herramienta | Uso |
|---|---|
| NestJS 11 | Framework HTTP, corre en `:3000` |
| PostgreSQL 15 | Base de datos, en contenedor Docker |
| TypeORM 0.3 | ORM, con `synchronize: true` (solo desarrollo) |
| Passport + JWT | Autenticación; contraseñas con bcrypt |
| `@google/generative-ai` | Gemini (`gemini-2.5-flash`) para los flujos de IA |
| Nodemailer | Correos de verificación y recuperación, vía SMTP de Gmail |
| Multer + Sharp | Subida y procesamiento de imágenes |
| `@nestjs/schedule` | Tareas programadas |

Módulos: `admin`, `ai`, `auth`, `mail`, `payments`, `portfolio`, `projects`, `quotes`, `storage`, `stores`, `subscriptions`, `users`.

### Frontend — `ferry/frontend`

| Herramienta | Uso |
|---|---|
| React 18 + TypeScript | UI |
| Vite 5 | Dev server y build, corre en `:5173` |
| Tailwind CSS | Estilos |
| `@vis.gl/react-google-maps` | Google Maps y autocompletado de direcciones |
| Recharts | Gráficas |
| `xlsx` / `papaparse` | Importación de catálogos |
| `react-qr-code` | QR para pagos |
| Wompi | Pasarela de pagos (Colombia) |

Vistas principales: `HomeView`, `MaterialFlow` (lista de materiales), `UserQuotesInbox` (cotizaciones recibidas), `StorePanel` (panel de la ferretería), `ProjectHub`, `AdminPanel`, y las pantallas de autenticación.

### Otros

- `app/` en la raíz del repositorio: módulo Android (Kotlin + Gradle), independiente del monolito web.
- `ferry/docker-compose.yml`: Postgres y el backend en contenedores.

> **Ferry no usa Firebase.** Lo usó en versiones anteriores y migró a NestJS + PostgreSQL + JWT. El proyecto de Google Cloud se llama `gen-lang-client-...` porque se creó vía Firebase/AI Studio, pero solo aloja las claves de Gemini y Maps.

---

## Cómo levantarlo en local

Este orden importa: el backend no arranca sin la base de datos.

1. **Docker Desktop** arriba y con el motor corriendo.
2. **Postgres**:
   ```bash
   docker compose up -d db
   ```
   Desde `ferry/`. Levanta `ferry_postgres` en `:5432` (base `ferry_db`, usuario `root`).
3. **Backend**:
   ```bash
   npm install && npm run start:dev
   ```
   Desde `ferry/backend`. Queda en `http://localhost:3000`.
4. **Frontend**:
   ```bash
   npm install && npm run dev
   ```
   Desde `ferry/frontend`. Queda en `http://localhost:5173`.

### Variables de entorno

Copia `.env.example` a `.env` en cada carpeta y rellena los valores. Los `.env` reales están en `.gitignore` y nunca deben commitearse.

Dos advertencias que cuestan tiempo si se pasan por alto:

- **Ni Nest ni Vite releen el `.env` en caliente.** Cualquier cambio exige reiniciar el proceso; recargar el navegador no basta.
- **`FRONTEND_URL`** (backend) arma los enlaces de los correos de verificación y recuperación. En local debe ser `http://localhost:5173`. Si apunta al servidor remoto, el enlace del correo lleva al otro entorno, donde el token no existe, y el usuario ve "El enlace no es válido o ya fue usado". Ese mismo archivo lo monta `docker-compose.yml` en producción, así que no debe desplegarse con el valor local.
- Todo lo que empiece por `VITE_` queda **visible en el bundle del navegador**. Ahí solo van claves públicas; los secretos van en el `.env` del backend.

---

## Servicios externos

| Servicio | Dónde | Estado al 2026-09-03 |
|---|---|---|
| Google Maps + Places | `VITE_GOOGLE_MAPS_API_KEY` (frontend) | ✅ Funcionando |
| Gemini | `GEMINI_API_KEY` (backend) | ✅ Funcionando |
| SMTP Gmail | `MAIL_*` (backend) | ⚠️ Revisar credenciales |
| Wompi | `VITE_WOMPI_PUBLIC_KEY` (frontend) + firma en backend | Sin verificar |

### Gemini

Los tres endpoints de IA (`/ai/parse-materials`, `/ai/analyze-image`, `/ai/smart-match`) comparten cliente, clave y modelo, así que fallan y se recuperan juntos.

**Modelo:** `gemini-3.6-flash`, definido en `ai.service.ts`. Google retira modelos para cuentas nuevas: `gemini-2.5-flash` empezó a responder `404` en cuanto la clave pasó a emitirse desde un proyecto recién creado. Si aparece un `404` con el texto *"no longer available to new users"*, el mensaje mismo indica a qué modelo migrar.

Cómo distinguir los errores de Google, que es lo que más confusión generó al configurarlo:

| Error | Significado | Se arregla en |
|---|---|---|
| `400 API_KEY_INVALID` | La clave no existe o fue revocada | El `.env` |
| `403 API_KEY_SERVICE_BLOCKED` | Falta habilitar esa API en las restricciones de la clave | Credenciales de Cloud |
| `403 PERMISSION_DENIED` | Proyecto bloqueado o sin facturación | Facturación de Cloud |
| `429 RESOURCE_EXHAUSTED` | La clave tiene permiso, pero no hay saldo | Saldo en AI Studio |
| `404 NOT_FOUND` | El modelo ya no está disponible para la cuenta | El código |
| `503` "high demand" | Sobrecarga temporal del modelo | Reintentar |

Una lección que costó varias horas: **una clave nueva en el mismo proyecto bloqueado no arregla nada.** `PERMISSION_DENIED` es un bloqueo de proyecto, no de credencial; hay que emitir la clave en un proyecto distinto y con facturación activa.

### SMTP

Al 2026-09-03 el `.env` tiene `MAIL_PASSWORD` con espacios y un prefijo que parece un error de pegado, y `MAIL_FROM` apunta a una cuenta distinta de `MAIL_USER`, cosa que Gmail suele rechazar. Conviene verificarlo antes de confiar en los correos.

### Google Maps

La clave necesita *Maps JavaScript API*, *Places API* y *Places API (New)* habilitadas en sus restricciones, y facturación activa en el proyecto. Conviene restringirla por referente HTTP (`localhost:5173` y el dominio de producción), porque queda expuesta en el navegador.

**Maps y Gemini deben vivir en el mismo proyecto de Google Cloud.** No es un requisito técnico, sino una lección práctica: al migrar Gemini a un proyecto nuevo y borrar el viejo, la clave de Maps —que seguía siendo la del proyecto eliminado— murió con él, y Maps dejó de funcionar de un momento a otro sin que nadie tocara el código. Si se cambia de proyecto, hay que reemitir **las dos** claves.

Errores de Maps y qué significan:

| Error | Significado |
|---|---|
| `BillingNotEnabledMapError` | El proyecto existe pero no tiene facturación activa |
| `DeletedApiProjectMapError` | El proyecto dueño de la clave fue eliminado; la clave está muerta y hay que emitir otra |
| `RefererNotAllowedMapError` | El dominio desde el que se carga no está en los referentes permitidos de la clave |

Para verificar una clave de navegador desde la terminal: si responde `"API keys with referer restrictions cannot be used with this API"`, la clave está **viva y bien restringida**. Ese "error" es la respuesta sana.

Ferry **no** usa Cloud Vision: el análisis de fotos va por Gemini (`analyzeImage` manda la imagen en base64 al mismo modelo).

---

## Bitácora de cambios — 2026-09-02

### Correos: enlace roto y botón invisible

- **`FRONTEND_URL` apuntaba al servidor remoto** estando en local, así que los correos de recuperación llevaban al entorno equivocado y el token no se encontraba. Corregido a `http://localhost:5173`. Verificado end-to-end: `forgot-password` → enlace → `reset-password` → `201`.
- **Botones de los correos rehechos** en `backend/src/mail/mail.service.ts`, tanto el de recuperación como el de verificación. Usaban `background: linear-gradient(...)` sobre un `<a>`, y Outlook/Hotmail ignora los gradientes: el fondo desaparecía y quedaba texto blanco sobre blanco, ilegible y sin aspecto de botón. Ahora son botones en tabla con `bgcolor` sólido, y el bloque de "copia este enlace" se reemplazó por un enlace clickeable de respaldo.

### Errores de IA: de callejón sin salida a salida manual

- **`ai.service.ts`**: `handleGeminiError` distingue ahora los fallos de credenciales (401/403, `PERMISSION_DENIED`, `denied access`, `api key not valid`) y responde **503** con un mensaje accionable, en vez del 500 genérico. Reintentar no sirve en ese caso. Aplica a los tres endpoints.
- **`geminiService.ts` y `aiService.ts`**: los errores ahora propagan el `status` HTTP, que antes se perdía.
- **`MaterialFlow.tsx`**: nuevo `handleAiUnavailable`. Ante un 503 ofrece capturar los materiales a mano y abre el editor manual, en lugar de dejar al usuario sin salida. Cubre el flujo de foto y el de texto.
- **`StorePanel.tsx`**: ante un 503, el banner indica a la ferretería que ingrese los precios manualmente. Aquí no hace falta diálogo: el formulario manual ya es el estado por defecto y Smart Match solo lo autocompleta.

Detalle a favor del diseño actual: `ai.controller.ts` descuenta los créditos **después** de que la IA responde, así que estos fallos no le queman créditos a la ferretería.

### Modelo de Gemini actualizado — 2026-09-03

Con la clave emitida en un proyecto nuevo, los tres flujos empezaron a fallar con `404`: Google retiró `gemini-2.5-flash` para cuentas nuevas. Se actualizaron las tres ocurrencias a `gemini-3.6-flash` en `ai.service.ts`.

Verificado contra el backend local: `parse-materials` parsea el texto a ítems, `analyze-image` extrae cinco materiales de una lista fotografiada, y `smart-match` devuelve `EXACT_MATCH` contra el catálogo.

En la misma sesión se agregó a `handleGeminiError` el caso del `503` de sobrecarga de Google, que antes caía en el `500` genérico. Ahora se traduce a `429` con un mensaje de reintento, porque es transitorio; el `503` sigue reservado para los fallos de credenciales, que es lo que el frontend usa para ofrecer la captura manual.

### Clave de Maps reemitida — 2026-09-03

Al borrar el proyecto de Google Cloud viejo, Maps empezó a fallar con `DeletedApiProjectMapError`: la clave del frontend pertenecía a ese proyecto. Se reemitió en el proyecto nuevo, con las tres APIs de Maps habilitadas y restricción por referente HTTP, y se actualizó `VITE_GOOGLE_MAPS_API_KEY`.

Verificado tras reiniciar Vite —que lee el `.env` solo al arrancar—: el autocompletado devuelve sugerencias reales y el navegador carga el script de Maps con la clave nueva.

### Limpieza

- Eliminado `frontend/src/firebase.ts`, que estaba vacío y marcado como *deprecated*. Se verificó que nada lo importaba.
- Corregido un `console.error` en `UserQuotesInbox.tsx` que aún decía "Detalle del error en Firebase" y leía un campo `e.code` que hoy siempre es `undefined`.
- Creado `backend/.env.example` (no existía) y actualizado `frontend/.env.example`.

### Infraestructura

- El contenedor `ferry_backend` quedaba en bucle de reinicio con `exec /usr/local/bin/npm: exec format error` — imagen construida para otra arquitectura. Docker lo relanzaba por el `restart: always` del compose y **competía por el puerto 3000** con el backend local, impidiendo que arrancara. Se detuvo con `docker stop ferry_backend`. Si no se usa en local, conviene bajarlo del compose o reconstruir la imagen.

---

## Deuda técnica conocida

- **`node_modules` está versionado** en `backend/`, lo que hace lentas las operaciones de git. Debería ir al `.gitignore` y removerse del índice.
- **`VITE_WOMPI_INTEGRITY_SECRET`** está en el `.env` del frontend. Es un secreto de firma y el prefijo `VITE_` lo incrustaría en el bundle. Ningún código lo usa —la firma se calcula en el backend—, así que la línea debería borrarse.
- **`frontend/src/env`** es un archivo suelto con variables `VITE_` que Vite no lee. Induce a error al editar configuración; conviene borrarlo.
- **`frontend/dist/`** contiene un build previo a la migración desde Firebase. Está desactualizado respecto a `src/`.
- **`synchronize: true`** en TypeORM altera el esquema automáticamente. Antes de producción debería migrarse a migraciones explícitas.
- `google.maps.places.Autocomplete` ya no se ofrece a clientes nuevos; Google recomienda migrar a `PlaceAutocompleteElement`.
