# Despliegue

> **Estado al 2026-09-16: en transición.** El frontend ya se despliega solo en Vercel. El backend estaba en un VPS de Hostinger que dejó de responder, y está pendiente decidir su nuevo destino. Ver *Estado actual* en [PROYECTO.md](PROYECTO.md).

## Frontend — Vercel (automático)

Cada push a `main` en **`Jersson001/ferry`** despliega el frontend solo. Nada que hacer a mano, salvo en dos casos:

- **Si cambias una variable de entorno en Vercel**, hay que redesplegar: *Deployments → ⋯ → Redeploy*, desmarcando *Use existing Build Cache*. Vite incrusta las variables al compilar, así que el build anterior no ve el cambio.
- **Si el push va a `origin`**, no despliega nada: en el clon local `origin` todavía apunta al repo viejo `ingdanielacastaneda-bit/ferry`. El que usa Vercel es el remoto `jersson`.

Configuración del proyecto en Vercel:

| Ajuste | Valor |
|---|---|
| Repositorio | `Jersson001/ferry` |
| Root Directory | `frontend` |
| `VITE_API_URL` | `https://api.ferryapp.co` |
| `VITE_GOOGLE_MAPS_API_KEY` | clave de Maps, **con** prefijo `VITE_` |
| `VITE_WOMPI_PUBLIC_KEY` | llave pública, **con** prefijo `VITE_` |

Vercel advierte que las variables `VITE_` con formato de clave deberían ser privadas. Para estas dos **no hay que hacerle caso**: están hechas para el navegador y sin el prefijo quedan en `undefined`. El secreto de integridad de Wompi, en cambio, nunca va en el frontend.

Para verificar un despliegue, lo más confiable es inspeccionar el bundle publicado: que la URL de la API sea la correcta y que no aparezca ningún secreto.

---

## Backend — VPS de Hostinger (en pausa)

> El VPS `2.25.68.84` no responde desde el 2026-09-16. Lo que sigue documenta cómo funcionaba, por si se reactiva; si el backend se muda a Render o Railway, esta sección queda obsoleta.

El backend **no tiene despliegue automático**: hacer `git push` no actualiza el servidor, que sigue con la versión anterior hasta que alguien la actualice a mano.

---

## Antes de empezar

Dos cosas que causan casi todos los despliegues fallidos:

**Los `.env` no viajan con el código.** Están en `.gitignore`, así que el servidor tiene los suyos y `git pull` no los toca. Si cambiaste una clave en local, hay que cambiarla también allá.

**Vite compila las variables dentro del bundle.** Todo lo `VITE_` se congela al hacer `npm run build`. Cambiar el `.env` del frontend sin reconstruir no surte ningún efecto.

---

## Diferencias entre local y producción

Estas variables **no** deben copiarse tal cual desde el entorno local:

| Variable | Local | Producción |
|---|---|---|
| `FRONTEND_URL` (backend) | `http://localhost:5173` | La URL pública |
| `VITE_API_URL` (frontend) | `http://localhost:3000` | La URL pública del backend |
| `JWT_SECRET` (backend) | cualquiera | Una cadena larga y distinta |
| `UPLOADS_BASE_URL` (backend) | — | La URL pública de `/uploads` |

`FRONTEND_URL` es la más delicada: arma los enlaces de los correos de verificación y recuperación. Si queda en `localhost`, los usuarios reciben enlaces que no llevan a ninguna parte.

También hay que revisar, del lado de Google Cloud, que la clave de Maps tenga el **dominio de producción** en sus restricciones de referente HTTP. Si solo autoriza `localhost:5173`, en el servidor falla con `RefererNotAllowedMapError`.

---

## Procedimiento

### 1. Traer el código

```bash
cd /ruta/del/proyecto/ferry && git pull origin main
```

### 2. Revisar si cambiaron las variables de entorno

Compara los `.env.example` con los `.env` del servidor. Si el despliegue agrega variables nuevas, aparecerán ahí:

```bash
diff <(cut -d= -f1 backend/.env.example | sort) <(cut -d= -f1 backend/.env | sort)
```

### 3. Backend

```bash
docker compose up -d --build backend
```

Reconstruye la imagen y recrea el contenedor. La base de datos no se toca.

### 4. Frontend

Ya no se construye en el servidor: lo publica Vercel. Ver la sección de arriba.

### 5. Verificar

```bash
curl -i https://TU-DOMINIO/api/
```

Debe responder `200` con `Hello World!`. Y en los logs:

```bash
docker compose logs --tail 30 backend
```

Busca `Nest application successfully started`. Si aparece un error de TypeORM, el backend no alcanzó la base de datos.

---

## Si algo sale mal

Para volver a la versión anterior:

```bash
git log --oneline -5
```

```bash
git checkout <commit-anterior> && docker compose up -d --build backend
```

Ojo con una cosa: TypeORM corre con `synchronize: true`, así que **altera el esquema automáticamente al arrancar**. Un rollback de código no revierte los cambios que ya hizo en la base. Es la razón principal para migrar a migraciones explícitas antes de tener datos que importen.

---

## Errores frecuentes

| Síntoma | Causa |
|---|---|
| El enlace del correo lleva al entorno equivocado | `FRONTEND_URL` con el valor de otro entorno |
| `RefererNotAllowedMapError` | La clave de Maps no autoriza el dominio de producción |
| El frontend no ve los cambios | Falta `npm run build`, o el servidor web sirve un `dist/` viejo |
| El frontend llama a `localhost:3000` | `VITE_API_URL` mal al momento de compilar |
| `exec format error` en el contenedor | Imagen de otra arquitectura, o datos de Docker corruptos — reconstruir con `--no-cache` |

Para los errores de Gemini y de Maps, la tabla de diagnóstico está en [PROYECTO.md](PROYECTO.md).

---

## Pendiente

Este proceso es manual y frágil. Lo que más lo mejoraría, en orden:

1. **CI/CD**: un workflow que despliegue al hacer push a `main`, y que el frontend se publique solo.
2. **Migraciones de TypeORM** en lugar de `synchronize: true`.
3. **Los `uploads/` viven en el disco del servidor.** Sobreviven a reinicios del contenedor por el volumen del compose, pero no hay respaldo. Conviene moverlos a almacenamiento de objetos.
4. **Documentar cómo se sirve el frontend**, que hoy no está en el repositorio.
