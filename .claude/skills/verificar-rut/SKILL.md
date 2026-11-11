---
name: verificar-rut
description: Verifica el RUT/NIT de un negocio colombiano (ferreterías y demás negocios de Ferry). Revisa el formato, el dígito de verificación de la DIAN (módulo 11) y la matrícula mercantil en el RUES (datos abiertos de Confecámaras): razón social, si está activa y renovada, y su actividad CIIU. Usar cuando pidan verificar, validar o revisar un RUT o NIT, calcular un dígito de verificación, o confirmar que una ferretería es un negocio real.
---

# Verificar RUT / NIT

## Qué se puede comprobar y con qué

| Comprobación | Fuente | Red |
|---|---|---|
| Formato (5 a 10 dígitos, DV opcional tras guion) | — | No |
| Dígito de verificación (DV) | Algoritmo módulo 11 de la DIAN | No |
| Matrícula mercantil: razón social, estado, cámara, último año renovado, CIIU | RUES en datos.gov.co (`c82u-588k`) | Sí |

**Lo que NO se puede consultar en automático:** el estado del RUT ante la DIAN (activo, suspendido o cancelado). Esa consulta (muisca.dian.gov.co, "Consulta de estado del RUT") tiene captcha y no tiene API pública. No intentes saltarte el captcha. Si hace falta ese dato, dile al usuario que lo consulte a mano allí.

Una persona natural sin matrícula mercantil (por ejemplo, un contratista independiente) puede tener un RUT válido y no aparecer en el RUES. `NO_REGISTRADO` no significa "RUT falso": significa que no hay registro mercantil con ese número.

## Cómo usarla

El script no tiene dependencias y necesita Node 18 o superior:

```bash
node .claude/skills/verificar-rut/scripts/verificar-rut.mjs 900123456-7 --nombre "Ferretería El Tornillo"
```

- Acepta varios RUT en una sola llamada. Para listas largas, de a 20 por llamada.
- `--nombre` compara el nombre declarado con la razón social (`parecidoNombre`, de 0 a 1).
- `--sin-red` solo revisa el formato y el DV.
- `--json` da una salida para procesar.
- Código de salida: 0 si todos quedan `VERIFICADO`, 1 si alguno no.

Rutas: desde la raíz del repo `ferry/`, el script está en `.claude/skills/verificar-rut/scripts/verificar-rut.mjs`.

### Cómo se lee el número

- Con guion (`900123456-7`), lo que va después del guion es el DV declarado y se comprueba.
- Sin guion, todos los dígitos se toman como el número y el DV se calcula (`dvDeclarado: null`). En ese caso el DV del `nit` normalizado lo puso el script, no el negocio.
- Sin guion y con 10 dígitos, el último dígito podría ser el DV pegado. El script busca en el RUES el número completo, que podría ser una cédula de 10 dígitos, y también los 9 primeros si el último coincide con su DV. Si solo aparecen los 9 primeros, el resultado es ese NIT.

## Estados

El orden de revisión es: formato, DV, registro en el RUES, matrícula inactiva o en liquidación, renovación. Se informa la primera regla que falla. Aun así, menciona todas las señales que veas, por ejemplo una empresa en liquidación que además no renueva desde 2006.

| Estado | Significa | Qué decir |
|---|---|---|
| `VERIFICADO` | DV correcto, matrícula ACTIVA y renovada el año en curso o el anterior | Es un negocio registrado. Revisa igual el nombre y la actividad. |
| `DV_INVALIDO` | El DV no corresponde al número | Casi siempre es un error de digitación. El script da `dvCorrecto`. |
| `FORMATO_INVALIDO` | No parece un NIT | Pedir el número tal como aparece en el RUT. |
| `NO_REGISTRADO` | DV correcto, pero sin matrícula en el RUES | Puede ser una persona natural sin matrícula, o un número inventado con DV calculado. Pedir el certificado de Cámara de Comercio o el PDF del RUT. |
| `MATRICULA_INACTIVA` | Cancelada, o la razón social dice "EN LIQUIDACIÓN" | No debe llevar el sello de verificada. |
| `SIN_RENOVAR` | Activa, pero sin renovar hace más de un año | Señal de negocio abandonado. Debe renovar la matrícula en su Cámara de Comercio. |
| `SIN_CONSULTA` | El RUES no respondió | Reintentar más tarde. |

## Señales que revisar aunque el estado sea VERIFICADO

1. **Nombre:** si `parecidoNombre` < 0.5, el NIT podría ser de otro negocio. Compara a ojo, porque un nombre comercial puede ser distinto de la razón social ("Ferretería La 80" frente a "INVERSIONES PÉREZ SAS").
2. **Actividad:** `actividadFerreteria` es true si algún CIIU es 4752 (ferretería al por menor) o 4663 (materiales de construcción y ferretería al por mayor). Si es false, no es descalificante: muchas ferreterías se registran con otra actividad principal. Menciónalo.
3. **Datos sucios del RUES:** la columna `nit` de las filas de personas naturales a veces trae valores ajenos. El script busca solo por `numero_identificacion`. No uses la columna `nit` para identificar a nadie.
4. **Varias matrículas** (`otrasMatriculas` > 0): normalmente son establecimientos de comercio del mismo dueño. El script elige la principal activa más reciente.

## Relación con la app

La app hace la misma verificación al guardar el RUT del perfil de una ferretería (`backend/src/users/rut.ts`) y guarda el resultado en `users.rutVerificacion`. El sello de "ferretería verificada" de los planes pagos exige `VERIFICADO`. Desde el panel de administración se puede reverificar una tienda o todas las pendientes (`POST /admin/verificar-rut/:userId`, `POST /admin/verificar-ruts-pendientes`).

Si cambias el cálculo en un lado, cámbialo en el otro: `backend/src/users/rut.paridad.spec.ts` lo comprueba.

## Privacidad

El RUES es información pública, pero la cédula y el nombre de una persona natural siguen siendo datos personales. Reporta solo lo necesario para decidir. No copies la identificación del representante legal en los informes.
