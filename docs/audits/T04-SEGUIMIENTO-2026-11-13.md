# T04 — Seguimiento del 13/11/2026

Actualización posterior: el usuario aportó la URL correcta de Vercel y se realizó
una [prueba de la portada pública](T04-DESPLIEGUE-PUBLICO-2026-11-13.md). Las
referencias siguientes a enlaces pendientes describen el momento previo a recibirla;
el backend y la revisión desplegada siguen sin identificar.

## Nota de consolidación del 14/11/2026

Los textos sobre falta de commits, Docker y enlaces pendientes pertenecen al
momento histórico del 13/11; no son comprobaciones actuales. Ya existen cuatro
commits de auditoría, enumerados en el [índice vigente](README.md). El cierre
reducido conserva 20 fuentes con hashes originales; el PASS de 26 fuentes de abajo
corresponde al validador y paquete existentes en esa fecha. El validador actual
solo comprueba RN y sincronización, no pantallas, enlaces ni hashes.

## Qué se comprobó el 13/11/2026

La base remota de develop continúa en `54b84064dc393477ec197c202a5ebd8a48b56aa8`.
No hay cambios que invaliden por sí solos el snapshot del 12/11. Los archivos de
auditoría siguen sin commit manual; no se descartó ningún cambio local.

| Verificación | Resultado |
|---|---|
| develop / main | Ambas siguen sin protección efectiva según branches; SHA sin cambios |
| Ruleset de protección | Sigue disabled |
| PR abiertos | Solo #89 devuelto (head 7831234, destino develop) |
| Últimas ejecuciones develop | API CI success / deploy frontend failure, ambas del 09/11 |
| PostgreSQL local | Docker Desktop sigue sin daemon accesible; no se ejecutan migraciones |
| Integridad documental | Validador PASS: 184 RN, 39 pantallas y 26 fuentes |
| Caso de uso de compensación | 2 pruebas nuevas de caracterización PASS; reproducen un riesgo, no su corrección |

Datos curados, sin credenciales: [snapshot del seguimiento](evidence/followup-2026-11-13.json).
No se repitieron suites completas ni se volvió a compilar porque el código productivo
no cambió. Las consultas remotas son lecturas; no se configuró ni desplegó nada.

## Riesgo B07 comprobado con una prueba ejecutable

En palabras simples: cuando un pago llega tarde, el sistema puede tener que devolver
el dinero. Antes de pedir la devolución, guarda que comenzó el trámite. Si el trámite
falla, el siguiente intento ve ese registro y se detiene, aunque el servicio ya funcione.

Las pruebas ejecutan el caso de uso real con dependencias en memoria:

1. El proveedor falla en el primer intento. Se recupera para el segundo, pero el
   caso de uso responde `COMPENSATION_ALREADY_EXISTS` sin volver a intentar refund.
2. El proveedor devuelve una referencia de reembolso, pero falla su registro.
   Tras recuperar la persistencia, el segundo intento tampoco registra esa referencia.

Esto confirma el comportamiento del caso de uso ante esas secuencias. **No prueba
un fallo real del proveedor, un movimiento de dinero ni PostgreSQL**. Tampoco se
debe corregir haciendo devoluciones ciegas en cada retry: T14/T31 necesita diseñar
reconciliación e idempotencia con el proveedor seleccionado.

Archivo: [caracterización](tests/payment-compensation.characterization.test.ts).
Desde la raíz:

```powershell
node apps/api/node_modules/tsx/dist/cli.mjs --test docs/audits/tests/payment-compensation.characterization.test.ts
```

Resultado: 2 pass, 0 fail, 0 skipped. PASS significa que se reprodujo el comportamiento
actual esperado por esta caracterización; **no significa que la devolución esté bien
resuelta funcionalmente**. No se cambió la clasificación general de las RN ni se
presenta esta prueba en memoria como evidencia de integración externa.

El archivo también pasó la verificación estricta de TypeScript, sin emisión:

```powershell
node apps/api/node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --typeRoots apps/api/node_modules/@types --types node docs/audits/tests/payment-compensation.characterization.test.ts
```

## Pendientes registrados el 13/11, no lista vigente de cierre

| Pendiente | Qué necesitamos | Qué hará la auditoría |
|---|---|---|
| Aplicación publicada | Enlace público de la web y, si existe, de la API | Revisar acceso, respuesta y health; registrar revisión desplegada cuando sea identificable |
| Persistencia | PostgreSQL dedicado de pruebas disponible | Ejecutar migraciones/tests allí, sin tocar producción ni una base de destino desconocido |
| Flujos autenticados | Sesión/cuentas de prueba de los roles | Recorrer acciones permitidas y denegadas, sin guardar contraseñas/tokens en informes |
| Pantallas reales | Aplicación ejecutable con contexto y datos | Comprobar móvil, teclado, errores y flujos que hoy solo fueron inspeccionados en código |
| Entrega al grupo | Revisión y commits manuales del usuario | Conservar evidencia y registrar límites; PR/revisión humana antes de incorporar a develop |

Se solicitaron los enlaces públicos al usuario. No hace falta enviar claves o tokens.
Hasta recibirlos, la producción continúa como no verificada; no se declara caída.
T04 identifica y documenta las brechas; sus correcciones siguen asignadas a otras
tareas. Esta continuación no implementa pagos, jobs, protección de ramas ni deploy.

Commit sugerido para esta unidad adicional:
`test(audit): caracterizar recuperacion de compensaciones pendientes`.


## Repetición segura durante el cierre del 14/11/2026

Se ejecutó de nuevo el comando de caracterización indicado arriba con dependencias
locales ya disponibles: 2 PASS, 0 FAIL, 0 SKIP. El caso real usa repositorios/provider
en memoria, sin acceso a PostgreSQL ni servicios externos. PASS reproduce el defecto
B07 y no lo resuelve. No se repitió la suite de 329 pruebas ni se ejecutaron migraciones.
El manifiesto reducido verificó 20 hashes originales; --update-hashes conservó su
conjunto sin incorporar siete copias auxiliares locales. Los checks RN pasaron;
las matrices RN y de pantallas permanecieron intactas. El chequeo de enlaces usó
solo archivos versionados más los 27 nuevos propuestos, sin depender de excluidos.
