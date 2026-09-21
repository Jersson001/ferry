# Despliegue

Ferry se despliega **solo**: cada push a `main` en `Jersson001/ferry` actualiza el frontend en Vercel y el backend en Render. No hay servidor que administrar a mano.

```
git push jersson main
        │
        ├──► Vercel  construye frontend/  → https://frontend-black-ten-37.vercel.app
        └──► Render  construye backend/   → https://ferry-jogo.onrender.com
                                                  └──► Supabase (Postgres)
```

> **Ojo con el remoto.** En el clon local, `origin` todavía apunta al repo viejo `ingdanielacastaneda-bit/ferry`, que no despliega nada. El que usan Vercel y Render es el remoto **`jersson`**. Un `git push` a secas no publica.

El estado detallado de cada pieza está en [PROYECTO.md](PROYECTO.md), sección *Producción*.

---

## Antes de desplegar

Tres cosas que causaron casi todos los despliegues fallidos:

**Los `.env` no viajan con el código.** Están en `.gitignore`. Las variables de producción se configuran en el panel de Vercel y en el de Render, no en el repo. Si agregas una variable nueva en local, hay que agregarla también allá.

**Vite incrusta las variables al compilar.** Cambiar una variable en Vercel no afecta al sitio publicado hasta que se redespliega.

**Algunas variables no se copian tal cual del entorno local:**

| Variable | Local | Producción |
|---|---|---|
| `FRONTEND_URL` (backend) | `http://localhost:5173` | URL pública del frontend |
| `VITE_API_URL` (frontend) | `http://localhost:3000` | `https://ferry-jogo.onrender.com` |
| `JWT_SECRET` (backend) | cualquiera | Una cadena larga, aleatoria y **distinta** |

`FRONTEND_URL` arma los enlaces de los correos de verificación y recuperación: si queda en `localhost`, los usuarios reciben enlaces que no llevan a ninguna parte.

Y `JWT_SECRET` no puede ser el valor de desarrollo: está publicado en el repo, y en producción el backend **se niega a arrancar** con él.

---

## Frontend — Vercel

| Ajuste | Valor |
|---|---|
| Repositorio | `Jersson001/ferry` |
| Root Directory | `frontend` |
| `VITE_API_URL` | `https://ferry-jogo.onrender.com` |
| `VITE_GOOGLE_MAPS_API_KEY` | clave de Maps, **con** prefijo `VITE_` |
| `VITE_WOMPI_PUBLIC_KEY` | llave pública, **con** prefijo `VITE_` |

**Si cambias una variable**, hay que redesplegar a mano: *Deployments → ⋯ → Redeploy*, desmarcando *Use existing Build Cache*.

Vercel advierte que las variables `VITE_` con formato de clave deberían ser privadas. Para estas dos **no hay que hacerle caso**: están hechas para el navegador y sin el prefijo quedan en `undefined`. El secreto de integridad de Wompi, en cambio, nunca va en el frontend.

La clave de Maps debe autorizar el dominio de Vercel en sus restricciones de referente HTTP, o Maps falla con `RefererNotAllowedMapError`.

---

## Backend — Render

| Ajuste | Valor |
|---|---|
| Modo | **Docker**, con `backend/Dockerfile` |
| Root Directory | `backend` |
| Docker Build Context Directory | **`.`** |
| Dockerfile Path | `Dockerfile` |
| Plan | Free |

Variables: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `FRONTEND_URL`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD` y `MAIL_FROM`.

Tres particularidades del plan gratuito:

- **Duerme tras 15 minutos sin tráfico.** La primera petición tarda 30–50 s mientras despierta.
- **El disco es efímero.** Lo que se guarde en `uploads/` se pierde en cada despliegue.
- **`SIGTERM` en los logs no es un error.** Es Render durmiendo el servicio o reemplazándolo por uno nuevo.

El servicio se creó como *Web Service* y no como *Blueprint*, así que Render **no aplica** el `render.yaml` del repo. Ese archivo queda como referencia de la configuración.

---

## Base de datos — Supabase

Se configura solo con `DATABASE_URL` en Render. Usar la cadena del **Session pooler**:

```
postgresql://postgres.<proyecto>:<clave>@aws-0-us-east-2.pooler.supabase.com:5432/postgres
```

- No el *transaction pooler* de puerto 6543: es para serverless y no soporta prepared statements.
- La contraseña no debe tener `?`, `@`, `#`, `/` ni `%`, que rompen la URL.

TypeORM crea y ajusta el esquema solo al arrancar, por `synchronize: true`.

---

## Verificar un despliegue

**Backend:**

```bash
curl https://ferry-jogo.onrender.com/
```

Debe responder `Hello World!`. Si tarda medio minuto, estaba dormido; es normal.

**Frontend:** lo más confiable es inspeccionar el bundle publicado, no el panel de Vercel. Descarga la página, busca el archivo `index-*.js` que referencia y verifica que la URL de la API sea la de Render y que no aparezca ningún secreto.

**Punta a punta:** iniciar sesión en el sitio publicado. Si funciona, las tres piezas están conectadas.

---

## Un despliegue fallido no tumba el sitio — y eso engaña

Si un despliegue nuevo compila pero no logra arrancar, Render lo marca **`update_failed`** y **sigue sirviendo la versión anterior**. El sitio responde normal, así que probarlo desde afuera no revela nada: las pruebas pasan contra el código viejo.

Pasó el 2026-09-21: tres despliegues con el arreglo de seguridad del `JWT_SECRET` fallaron en silencio, y producción siguió corriendo la versión vulnerable mientras todas las pruebas daban bien.

Por eso, después de cada push, confirmar en Render → **Events** que el último despliegue diga **Live** y corresponda al commit esperado. Si dice `update_failed`, la causa está en los logs de ese despliegue.

---

## Si algo sale mal

Tanto Vercel como Render guardan los despliegues anteriores y permiten volver a uno con un clic: *Rollback* en Vercel, *Rollback* en los eventos del servicio en Render.

Ojo: TypeORM corre con `synchronize: true`, así que **altera el esquema de la base al arrancar**. Volver a una versión anterior del código no revierte esos cambios en la base. Es la razón principal para pasar a migraciones explícitas antes de tener datos reales.

---

## Errores frecuentes

| Síntoma | Causa |
|---|---|
| Render busca `.../backend/backend` | `backend` puesto a la vez en Root Directory y en Docker Build Context |
| Render construye un commit viejo | Los cambios se subieron a `origin` y no a `jersson` |
| `FATAL: JWT_SECRET tiene el valor de desarrollo` | Se copió el `.env` local a Render; poner un secreto propio |
| Despliegue en `update_failed` pero el sitio responde | Render sigue sirviendo la versión anterior; ver logs del despliegue |
| `npm error ... signal SIGTERM` | Apagado normal de Render, no un fallo |
| El frontend no ve un cambio de variable | Falta redesplegar en Vercel |
| El frontend llama a `localhost` | `VITE_API_URL` mal puesta al compilar |
| El enlace del correo lleva al entorno equivocado | `FRONTEND_URL` con el valor de otro entorno |
| `RefererNotAllowedMapError` | La clave de Maps no autoriza el dominio de Vercel |
| `password authentication failed` | Contraseña de Supabase equivocada, o con caracteres que rompen la URL |

Para los errores de Gemini y de Maps, la tabla de diagnóstico está en [PROYECTO.md](PROYECTO.md).

---

## Infraestructura anterior

Hasta el 2026-09-16 el backend y la base vivían en un VPS de Hostinger (`2.25.68.84`), que dejó de responder. El DNS de `api.ferryapp.co` todavía apunta ahí y conviene borrarlo o reapuntarlo. La configuración de nginx con HTTPS que se preparó para ese servidor está en `deploy/nginx/`, sin uso.
