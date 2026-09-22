# Ferry 2.0

Plataforma que conecta constructores con ferreterías: el constructor publica una lista de materiales y las ferreterías cercanas le envían cotizaciones.

Documento de referencia del proyecto: stack, cómo levantarlo en local, estado de los servicios externos y bitácora de cambios.

---

## Stack

### Backend — `ferry/backend`

| Herramienta | Uso |
|---|---|
| NestJS 11 | Framework HTTP, corre en `:3000` |
| PostgreSQL | Base de datos: Supabase en producción, contenedor Docker en local |
| TypeORM 0.3 | ORM, con `synchronize: true` (solo desarrollo) |
| Passport + JWT | Autenticación; contraseñas con bcrypt |
| `@google/generative-ai` | Gemini (`gemini-3.6-flash`) para los flujos de IA |
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
- `ferry/docker-compose.yml`: Postgres y el backend en contenedores, para desarrollo local.
- `ferry/render.yaml`: blueprint de Render, de referencia.
- `ferry/deploy/nginx/`: proxy HTTPS preparado para el VPS, hoy sin uso.

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

## Producción — estado al 2026-09-21

Ferry está en internet, con todo en planes gratuitos:

```
Navegador ──► Vercel (frontend) ──► Render (backend NestJS) ──► Supabase (Postgres)
                                          └──► Gemini, SMTP de Gmail
```

| Pieza | Servicio | URL | Estado |
|---|---|---|---|
| Frontend | Vercel | `https://frontend-black-ten-37.vercel.app` | ✅ |
| Backend | Render, modo Docker | `https://ferry-jogo.onrender.com` | ✅ |
| Base de datos | Supabase | — | ✅ |
| Login y sesión | — | — | ✅ Verificado de punta a punta |
| Google Maps | — | — | ✅ Autocompletado verificado en producción |
| IA | — | — | ⚠️ Conecta, pero desde Render Google respondió sobrecargado |

La infraestructura anterior —un VPS de Hostinger con Postgres adentro— dejó de responder el 2026-09-16, probablemente por falta de pago. Solo tenía datos de prueba, así que no se perdió nada real.

### Repositorio

El repo oficial es **`Jersson001/ferry`**, el que usan Vercel y Render. El anterior, `ingdanielacastaneda-bit/ferry`, quedó atrás.

- **`Jersson001/ferry` es privado** desde el 2026-09-22. Estuvo público unos días; se revisó todo el historial y no expuso ninguna credencial vigente, solo una clave de Maps de un proyecto de Google Cloud ya borrado. El `JWT_SECRET` de desarrollo sí estaba en el código, pero producción ya no lo acepta.
- En el clon local, `origin` es `Jersson001/ferry` desde el 2026-09-22, y el repo viejo quedó como remoto `viejo`. Pendiente: archivarlo en GitHub para que nadie siga subiendo cambios ahí.

### Frontend — Vercel

- Equipo *Jersson Escobar's projects*, plan **Hobby**. Sus términos lo limitan a uso no comercial; con pagos reales corresponde Pro.
- Proyecto enlazado a `Jersson001/ferry` con **Root Directory = `frontend`**. Se despliega solo en cada push a `main`.
- `frontend/vercel.json` reescribe todas las rutas a `index.html`. Sin eso, los enlaces de los correos a `/reset-password` y `/verify-email` dan 404.
- Variables: `VITE_API_URL=https://ferry-jogo.onrender.com`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_WOMPI_PUBLIC_KEY`. Verificado sobre el bundle publicado: las tres presentes y el secreto de integridad de Wompi ausente.
- El conector de Vercel usado para administrar no encuentra este proyecto por la API, aunque sí ve los demás. La forma confiable de verificar un despliegue es inspeccionar el bundle publicado.

Trampas que costaron redespliegues:

- **Cambiar variables no redespliega.** Hay que hacer *Redeploy* a mano, porque Vite las incrusta al compilar.
- Vercel advierte que las variables `VITE_` con formato de clave "deberían ser privadas". **Hay que ignorarlo** para la clave de Maps y la llave pública de Wompi, que están hechas para el navegador: sin el prefijo quedan en `undefined`.
- `VITE_API_URL` apuntando a `localhost` no sirve en producción: en el navegador de cada visitante, `localhost` es su propio equipo.

Pendiente: renombrar el proyecto, conectar `ferryapp.co`, y borrar el proyecto viejo `ferry-001`, enlazado a un repo vacío.

### Backend — Render

- Plan **Free**, en modo **Docker**: usa `backend/Dockerfile`. El servicio no se creó como *Blueprint*, así que el `render.yaml` del repo sirve como referencia pero Render no lo aplica.
- **Root Directory = `backend`** y **Docker Build Context Directory = `.`**. Si el contexto también dice `backend`, Render busca `backend/backend` y el build falla.
- Se duerme tras 15 minutos sin tráfico: la primera petición tarda 30–50 s.
- El disco es **efímero**: se borra en cada despliegue o reinicio. Por eso las fotos y videos van a **Supabase Storage**, bucket público `uploads`, activado por las variables `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Si faltan, el backend guarda en disco sin avisar como error: confirmar que el log de arranque diga *"Archivos en Supabase Storage"* y no *"Archivos en disco local"*.
- Arranca con `node dist/main`, no con `npm run start:prod`: npm reportaba el apagado normal de Render como `npm error ... signal SIGTERM`. Un `SIGTERM` en los logs de Render es Render durmiendo o reemplazando la instancia, no un fallo.
- Variables: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `FRONTEND_URL` y las `MAIL_*`. `JWT_SECRET` debe ser propio: en producción el backend **se niega a arrancar** con el valor de desarrollo, que está publicado en el repo.

### Base de datos — Supabase

- Plan **Free**: 500 MB de base, 1 GB de archivos, y **se pausa tras una semana sin uso**.
- Se usa **solo como Postgres**. Autenticación, cotizaciones, pagos y suscripciones siguen en NestJS: reescribirlos sobre Supabase habría sido una migración enorme sin beneficio claro.
- Conexión por el **Session pooler** (puerto 5432, host `*.pooler.supabase.com`, usuario `postgres.<proyecto>`). No el transaction pooler de 6543, que es para serverless y no soporta prepared statements; no la conexión directa, que depende de IPv6 o de un complemento pago.
- La contraseña de la base no debe tener `?`, `@`, `#`, `/` ni `%`: rompen la URL de conexión.
- TypeORM crea el esquema solo con `synchronize: true`.

⚠️ **Hoy el backend local y el de producción comparten esta base**, porque el `.env` local también tiene `DATABASE_URL`. Mientras sean pruebas no importa; antes de tener usuarios reales, el local debe volver al Postgres de Docker comentando esa línea.

### Costos

| Servicio | Gratis | Siempre encendido |
|---|---|---|
| Render | Free: duerme tras 15 min | Starter, $7/mes |
| Railway (alternativa) | $1/mes de uso, no alcanza | Hobby, $5/mes |
| Supabase | 500 MB, se pausa tras 1 semana sin uso | Pro, desde $25/mes |

Con usuarios reales, lo mínimo razonable es Render Starter: unos $7 al mes.

---

## Servicios externos

| Servicio | Dónde | Estado al 2026-09-21 |
|---|---|---|
| Google Maps + Places (New) | `VITE_GOOGLE_MAPS_API_KEY` (frontend) | ✅ Local y en Vercel |
| Gemini | `GEMINI_API_KEY` (backend) | ⚠️ Nivel gratuito, 20 peticiones al día; `503` intermitentes desde Render |
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

La clave de Maps es la **"Clave API 2"**, en el mismo proyecto de Google Cloud que Gemini. Necesita:

- En el proyecto, **habilitadas** *Maps JavaScript API* y **Places API (New)** (*APIs y servicios → Biblioteca*).
- En la clave, esas mismas dos en **Restricciones de API**, y en **Restricciones de aplicaciones → Sitios web**: `https://frontend-black-ten-37.vercel.app/*` y `http://localhost:5173/*`.
- Facturación activa en el proyecto.

El autocompletado de direcciones usa **Places API (New)**, no la *legacy* `google.maps.places.Autocomplete`. Google dejó de ofrecer la legacy a proyectos creados desde marzo de 2025: en ellos falla con `LegacyApiNotActivatedMapError` y no hay forma de activarla. El código vive en `hooks/usePlacesAutocomplete.ts` y `components/PlaceSuggestionsDropdown.tsx`, y lo usan los tres campos de dirección.

**Maps y Gemini deben vivir en el mismo proyecto de Google Cloud.** No es un requisito técnico, sino una lección práctica: al migrar Gemini a un proyecto nuevo y borrar el viejo, la clave de Maps —que seguía siendo la del proyecto eliminado— murió con él, y Maps dejó de funcionar de un momento a otro sin que nadie tocara el código. Si se cambia de proyecto, hay que reemitir **las dos** claves.

Errores de Maps y qué significan:

| Error | Significado |
|---|---|
| `BillingNotEnabledMapError` | El proyecto existe pero no tiene facturación activa |
| `DeletedApiProjectMapError` | El proyecto dueño de la clave fue eliminado; la clave está muerta y hay que emitir otra |
| `RefererNotAllowedMapError` | El dominio desde el que se carga no está en los referentes permitidos de la clave. Verificar que se editó **la misma clave que usa el sitio**: el 2026-09-21 se autorizó el dominio en otra y no cambió nada |
| `LegacyApiNotActivatedMapError` | Código usando una API legacy en un proyecto nuevo; hay que migrar a la versión New |
| `Places API (New) has not been used in project…` | La API no está habilitada en el proyecto, o la clave no la tiene en sus restricciones |

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

### Fotos en Supabase Storage y ajustes de IA — 2026-09-22

- **Fotos y videos en Supabase Storage.** Antes se guardaban en el disco de Render, que se borra en cada despliegue. `StorageService` sube a Supabase si están sus variables y cae al disco local si no, sin cambiar su interfaz: portafolio, proyectos y catálogo no se tocaron. El bucket se crea solo, como público, en la primera subida. Verificado en producción: una foto subida por Render queda en Supabase, es accesible por su URL y se guarda comprimida a WebP.
- **Reintento automático en Gemini** ante sobrecarga (`503`) o límites por minuto, con máximo 3 intentos. No reintenta lo que esperar no arregla: cuota diaria, saldo agotado, clave o permisos.
- **Saldo de Gemini agotado** ahora ofrece la captura manual. Google pasó a devolverlo como `402` y llegaba al usuario como error genérico.
- **Repo privado**, y `Jersson001/ferry` pasó a ser `origin` en el clon local.

### Backend en Render con Supabase — 2026-09-21

- **Base en Supabase.** `app.module.ts` acepta `DATABASE_URL` con TLS y cae a los campos sueltos del docker-compose si no está, así el mismo código sirve en local y en producción. Primero se probó desde el equipo local: TypeORM creó las 13 tablas y registro y login funcionaron contra Supabase.
- **Backend en Render**, modo Docker. Dos tropiezos de configuración: un despliegue construyó un commit viejo porque faltaba subir los cambios, y otro buscó `backend/backend` por tener la carpeta en dos campos que se suman.
- **`JWT_SECRET` público cerrado.** El valor por defecto estaba escrito en el repo, que es público: con él cualquiera podía firmar sesiones de cualquier usuario. Se eliminó el valor por defecto y en producción el backend se niega a arrancar con ese valor.
  Al arreglarlo apareció un bug escondido: `JwtModule.register` leía el secreto al importar el archivo, antes de que se cargara el `.env`. En local los tokens se firmaban con el valor por defecto y se verificaban con el del `.env`, y funcionaba solo porque ambos coincidían. Ahora usa `registerAsync` y lee el secreto con la configuración ya cargada.
- **`docker-compose.yml`** vacía `DATABASE_URL` para que el contenedor local use su Postgres y no Supabase.
- **Apagado limpio.** El contenedor arranca con `node dist/main` y Nest cierra las conexiones al recibir `SIGTERM`.
- **Frontend reapuntado** a `https://ferry-jogo.onrender.com`. Verificado en el navegador: login funcionando de punta a punta.

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

Ordenada por urgencia antes de tener usuarios reales:

- **`synchronize: true`** en TypeORM altera el esquema de producción automáticamente al arrancar, y un rollback de código no lo revierte. Hay que pasar a migraciones explícitas.
- **Local y producción comparten la base de Supabase** mientras el `.env` local tenga `DATABASE_URL`.
- **Gemini en nivel gratuito**, 20 peticiones al día, y sin reintento ante los `503` de sobrecarga.
- **`node_modules` está versionado** en `backend/`, lo que hace lentas las operaciones de git. Debería ir al `.gitignore` y removerse del índice.
- **`VITE_WOMPI_INTEGRITY_SECRET`** está en el `.env` del frontend. Es un secreto de firma y el prefijo `VITE_` lo incrustaría en el bundle. Ningún código lo usa —la firma se calcula en el backend—, así que la línea debería borrarse.
- **`frontend/src/env`** es un archivo suelto con variables `VITE_` que Vite no lee. Induce a error al editar configuración; conviene borrarlo.
- **`frontend/dist/`** contiene un build previo a la migración desde Firebase. Está desactualizado respecto a `src/`.
- **`synchronize: true`** en TypeORM altera el esquema automáticamente. Antes de producción debería migrarse a migraciones explícitas.
