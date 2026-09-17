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

## Estado actual — 2026-09-16

> Migración de infraestructura **a medio camino**. Leer esta sección antes de tocar nada.

| Pieza | Dónde | Estado |
|---|---|---|
| Frontend | Vercel, proyecto `frontend` | ✅ Desplegado y bien configurado — pero sin backend al cual llamar |
| Backend | VPS Hostinger `2.25.68.84` | ❌ **Caído**: no responde en ningún puerto, ni SSH. Probable suspensión por falta de pago |
| Base de datos | Postgres dentro del VPS | ❌ Caída junto con el VPS. Solo tenía datos de prueba |
| Dominio | `ferryapp.co` en Hostinger, activo hasta mayo 2027 | ⚠️ `api` apunta al VPS; `@` y `www` siguen en el parking de Hostinger |
| Entorno local | Tu equipo | ✅ Todo funciona |

**Todo lo que había en producción eran pruebas**, así que perder el VPS no cuesta datos reales. El código del backend está completo en el repo y en el equipo local.

### Repositorio

El repo oficial pasó a ser **`Jersson001/ferry`**, que es el que ve Vercel. El anterior, `ingdanielacastaneda-bit/ferry`, quedó atrás: la cuenta de Vercel no tiene acceso a él.

En el clon local, `origin` **todavía apunta al repo viejo**; el nuevo está como remoto `jersson`. Pendiente: convertir `jersson` en `origin` y archivar el repo viejo, para que nadie siga subiendo cambios ahí.

### Frontend en Vercel

- Equipo *Jersson Escobar's projects*, plan **Hobby** (uso no comercial según los términos de Vercel; para producción con pagos corresponde Pro).
- Proyecto `frontend`, enlazado a `Jersson001/ferry` con **Root Directory = `frontend`**. Se despliega solo en cada push a `main`.
- URL temporal: `frontend-black-ten-37.vercel.app`. Pendiente: renombrar el proyecto a `ferry` y conectar `ferryapp.co`.
- `frontend/vercel.json` reescribe todas las rutas a `index.html`. Sin eso, los enlaces de los correos a `/reset-password` y `/verify-email` dan 404.
- Variables configuradas en Vercel: `VITE_API_URL=https://api.ferryapp.co`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_WOMPI_PUBLIC_KEY`. Verificado sobre el bundle publicado: las tres presentes, el secreto de integridad de Wompi ausente.

Dos trampas de Vercel que costaron redespliegues:

- **Cambiar variables no redespliega.** Hay que hacer *Redeploy* a mano, porque Vite las incrusta al compilar.
- Vercel advierte que las variables `VITE_` con formato de clave "deberían ser privadas". **Hay que ignorarlo** para la clave de Maps y la llave pública de Wompi: están hechas para el navegador. Quitar el prefijo las deja en `undefined` y rompe Maps y los pagos.

La clave de Maps debe autorizar en sus restricciones de referente los dominios de Vercel y `ferryapp.co`, además de `localhost:5173`.

Existe además un proyecto viejo `ferry-001` enlazado a `Jersson001/ferry-1.2`, un repo sin contenido. No sirve; se puede borrar.

### Por qué el frontend todavía no funciona en línea

Vercel sirve todo por HTTPS, y los navegadores **bloquean** que una página HTTPS llame a una API por HTTP. El backend solo respondía por `http://2.25.68.84:3000`, así que necesita un dominio con certificado. Se preparó `deploy/nginx/api.ferryapp.co.conf` para eso, pero no llegó a instalarse porque el VPS se cayó antes.

### Decisión pendiente: dónde correr el backend

El plan conversado es dejar el VPS y usar servicios administrados, conservando el backend NestJS tal como está:

- **Base de datos → Supabase**, pero **solo como Postgres y almacenamiento de archivos**. No su autenticación ni sus políticas RLS: reescribir auth, cotizaciones, pagos y suscripciones sobre Supabase sería una migración enorme sin beneficio claro. TypeORM se conecta a Supabase como a cualquier Postgres.
- **Backend → Render o Railway.** Supabase no ejecuta un servidor NestJS.

Costos revisados el 2026-09-16:

| Servicio | Gratis | Siempre encendido |
|---|---|---|
| Render | Free: se apaga tras 15 min sin uso, ~1 min en despertar | Starter, $7/mes |
| Railway | $1/mes de uso, no alcanza para un backend encendido | Hobby, $5/mes |
| Supabase | 500 MB de base, 1 GB de archivos, se pausa tras 1 semana sin uso | Pro, desde $25/mes |

Recomendación: **Render Free + Supabase Free mientras sean pruebas** ($0), y pasar a Render Starter o Railway Hobby (~$5–7/mes) cuando haya usuarios. Con Render Free, la primera petición tras un rato de inactividad se suma a los 15–35 s que ya tarda Gemini: aceptable para probar, no para usuarios.

Cambios de código que implicaría:

1. Cadena de conexión de TypeORM apuntando a Supabase.
2. `uploads/` en disco no sobrevive en Render ni Railway (disco efímero): migrar `storage` a Supabase Storage.
3. Pasar de `synchronize: true` a migraciones, antes de tener datos reales.
4. `FRONTEND_URL` del backend con la URL de Vercel o `ferryapp.co`, y actualizar `VITE_API_URL` en Vercel con la URL del backend nuevo.

---

## Servicios externos

| Servicio | Dónde | Estado al 2026-09-16 |
|---|---|---|
| Google Maps + Places | `VITE_GOOGLE_MAPS_API_KEY` (frontend) | ✅ Funcionando en local y en el bundle de Vercel |
| Gemini | `GEMINI_API_KEY` (backend) | ⚠️ Funciona, pero en **nivel gratuito: 20 peticiones al día** |
| SMTP Gmail | `MAIL_*` (backend) | ✅ Funcionando en local |
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

**Cuota y latencia.** La clave actual está en **nivel gratuito: 20 peticiones diarias** para `gemini-3.6-flash` (métrica `generate_content_free_tier_requests`). El pago hecho en AI Studio no se está aplicando a esta clave. Con ese límite la app no es viable en producción, porque cada foto o lista de un usuario consume una petición. Revisar el nivel en [ai.dev/rate-limit](https://ai.dev/rate-limit).

Tiempos medidos: `/ai/parse-materials` tardó 33, 14 y 22 s en tres intentos; la misma consulta directa a Google, 4,3 s. El modelo gasta más tokens razonando que respondiendo (426 de razonamiento contra 137 de salida). Mejoras posibles, por impacto:

1. Salir del nivel gratuito: más prioridad en la cola, menos `503`.
2. Reducir el razonamiento. `thinkingBudget: 0` es rechazado con `400` por este modelo; falta probar `thinkingLevel: "low"`, que puede requerir migrar al SDK `@google/genai`.
3. Reintento con backoff para `503` y `429`; Google incluye `retryDelay` en la respuesta.
4. Redimensionar las fotos antes de enviarlas (`sharp` ya es dependencia).

### SMTP

Gmail por SMTP (`smtp.gmail.com:587`, sin SSL directo). `MAIL_PASSWORD` es una **contraseña de aplicación**, no la contraseña de la cuenta.

Requisitos para que Gmail acepte la autenticación:

- La contraseña de aplicación debe generarse desde la **misma cuenta** que está en `MAIL_USER`. Una generada desde otra cuenta da `535` aunque sea válida.
- Esa cuenta necesita verificación en dos pasos activa; sin ella Google no emite contraseñas de aplicación.
- Se pega en **16 caracteres seguidos, sin espacios**. Google la muestra en cuatro grupos de cuatro y los espacios hay que quitarlos; si quedan, Gmail recibe otra cadena y rechaza.
- `MAIL_FROM` debe usar la misma dirección de `MAIL_USER`. Gmail suele rechazar remitentes distintos al autenticado.

Síntoma de que algo de lo anterior falla: `535-5.7.8 Username and Password not accepted` con `code: 'EAUTH'` en el log. Es de Google, no de Ferry — el código llegó a conectarse.

Para probar el envío sin molestar a nadie, pide un reset con el usuario de prueba de dominio `.test`: el correo rebota, pero el log confirma si la autenticación pasó, que es lo que interesa.

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

### Migración a Vercel y caída del VPS — 2026-09-16

- **Contenedor del backend reparado.** Quedaba en bucle con `exec format error`. No era la arquitectura: el disco virtual de Docker Desktop estaba corrupto y extraía las imágenes con archivos en 0 bytes, incluso una imagen oficial recién descargada. `npm install` y `npm run build` "pasaban" sin hacer nada porque ejecutar un archivo vacío devuelve éxito. Se resolvió con *Troubleshoot → Clean / Purge data* (solo WSL 2) y reconstrucción con `--no-cache`. La base local se recreó vacía.
- **Repo movido a `Jersson001/ferry`**, porque Vercel no tenía acceso a `ingdanielacastaneda-bit/ferry`, privado y de otra cuenta.
- **Frontend desplegado en Vercel** con `vercel.json` para las rutas SPA. Hicieron falta tres despliegues: el primero sin variables, el segundo con `VITE_API_URL` apuntando a `localhost`. Ver la sección *Estado actual*.
- **Registro DNS `api.ferryapp.co` → `2.25.68.84`** creado y propagado.
- **El VPS dejó de responder** en todos los puertos antes de poder instalar nginx y HTTPS. Queda en pausa la decisión de dónde correr el backend.

### Modelo de Gemini actualizado — 2026-09-03

Con la clave emitida en un proyecto nuevo, los tres flujos empezaron a fallar con `404`: Google retiró `gemini-2.5-flash` para cuentas nuevas. Se actualizaron las tres ocurrencias a `gemini-3.6-flash` en `ai.service.ts`.

Verificado contra el backend local: `parse-materials` parsea el texto a ítems, `analyze-image` extrae cinco materiales de una lista fotografiada, y `smart-match` devuelve `EXACT_MATCH` contra el catálogo.

En la misma sesión se agregó a `handleGeminiError` el caso del `503` de sobrecarga de Google, que antes caía en el `500` genérico. Ahora se traduce a `429` con un mensaje de reintento, porque es transitorio; el `503` sigue reservado para los fallos de credenciales, que es lo que el frontend usa para ofrecer la captura manual.

### Clave de Maps reemitida — 2026-09-03

Al borrar el proyecto de Google Cloud viejo, Maps empezó a fallar con `DeletedApiProjectMapError`: la clave del frontend pertenecía a ese proyecto. Se reemitió en el proyecto nuevo, con las tres APIs de Maps habilitadas y restricción por referente HTTP, y se actualizó `VITE_GOOGLE_MAPS_API_KEY`.

Verificado tras reiniciar Vite —que lee el `.env` solo al arrancar—: el autocompletado devuelve sugerencias reales y el navegador carga el script de Maps con la clave nueva.

### SMTP arreglado — 2026-09-03

Los correos fallaban con `535 EAUTH`. Fueron dos causas encadenadas: `MAIL_FROM` apuntaba a una cuenta distinta de `MAIL_USER`, y la contraseña de aplicación estaba mal —con espacios, un prefijo pegado por error y un número de caracteres que no daba 16—. Se alineó `MAIL_FROM` y se regeneró la contraseña desde la cuenta correcta.

Verificado: `POST /auth/forgot-password` deja en el log `Email enviado`, sin `EAUTH`.

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
