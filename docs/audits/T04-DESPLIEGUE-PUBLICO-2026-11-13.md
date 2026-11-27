# T04 — Comprobación de la web publicada

Observación inicial: 13/11/2026 (America/Buenos_Aires).
Reconsulta aprobada: 14/11/2026 (America/Buenos_Aires).
URL suministrada por el usuario: https://take-and-go-web.vercel.app/.

Estado de revisión: el usuario aceptó expresamente esta comprobación como evidencia
de T04. La aceptación se limita a lo observado; no certifica una demo completa,
el backend ni las funcionalidades todavía pendientes de comprobar.

## Observación inicial del 13/11/2026

**Existe una web pública de Take&Go en Vercel.** La portada responde HTTP 200,
se identifica como Take&Go y muestra el diagnóstico de sistema. En el navegador
se observó este mensaje efectivo de la versión publicada:

> Backend no disponible
>
> La variable NEXT_PUBLIC_API_URL no está configurada

Esto prueba que el frontend no dispone de la dirección de API en el circuito
observado. **No prueba que el servicio backend esté caído**, ni que no exista, ni
permite afirmar cómo están configuradas las variables en el dashboard de Vercel.
No se pudo consultar `/health` de la API porque no se identificó su URL.

## Pruebas de solo lectura del 13/11/2026

| URL / comprobación | Resultado observado |
|---|---|
| `/` | HTTP 200, título Take&Go, headings Take&Go / Estado del sistema |
| `/login` | HTTP 404 |
| `/registro` | HTTP 404 |
| `/buffets` | HTTP 404 |
| Portada en navegador con JavaScript | Muestra error de NEXT_PUBLIC_API_URL; no hay enlaces de acceso actuales |
| Bundle de página `/_next/static/chunks/35ihnih_-ji60.js` | Contiene lectura de NEXT_PUBLIC_API_URL y consulta a /health; sin URL API literal identificada en ese bundle |

Se consultaron esas rutas porque existen en develop, no por adivinar rutas de login.
La portada desplegada no incluye los accesos de `apps/web/src/app/page.tsx` de la
base `54b84064dc393477ec197c202a5ebd8a48b56aa8`. Hay una diferencia concreta
entre ese código y la web publicada. Una versión anterior o una configuración de
despliegue distinta son posibles explicaciones; **no se identificó el SHA publicado**.

Método: GET públicos mediante Invoke-WebRequest y lectura del árbol de accesibilidad
de la portada en navegador. No hubo registro, login, envío de formularios, compras,
lectura de credenciales, configuración remota ni nuevo despliegue.
La consulta web textual inicial no pudo acceder; no se consideró eso una caída.
Las respuestas HTTP y la comprobación posterior en navegador sí constituyen evidencia.

## Reconsulta de solo lectura del 14/11/2026

La fecha del archivo conserva la observación inicial; esta sección registra la
verificación posterior, aprobada por el usuario. No reemplaza evidencia del 13/11.
Método: GET públicos mediante urllib.request y lectura de portada con JavaScript
en navegador. Sin autenticación, formularios ni cambios de servicios. Los intentos
iniciales del entorno restringido fallaron por DNS/acceso de herramienta; no se
consideraron caída. Los GET posteriores autorizados sí devolvieron respuestas.

| URL / comprobación | 13/11 | 14/11 |
|---|---|---|
| / | HTTP 200, Take&Go | HTTP 200, título Take&Go, servidor Vercel |
| /login | HTTP 404 | HTTP 404 |
| /registro | HTTP 404 | HTTP 404 |
| /buffets | HTTP 404 | HTTP 404 |
| /pedidos | No registrada esa consulta | HTTP 404 |
| /admin | No registrada esa consulta | HTTP 404 |
| Portada con JavaScript | NEXT_PUBLIC_API_URL no configurada | Mismo mensaje; sin accesos de login/registro del código auditado |

Son rutas presentes en el código BASE, no URLs inventadas para diagnosticar al
backend. El texto observado es:

> Backend no disponible
>
> La variable NEXT_PUBLIC_API_URL no está configurada

El primer texto es una etiqueta de UI: no es una prueba de caída del backend.
El segundo acredita que el circuito frontend observado no tiene disponible la
URL de API; no determina si la variable falta en el panel, en qué entorno/build
se definió ni cuál es la causa. Esas configuraciones no se consultaron.

## Versión y servicios no verificados

| Dato | Estado | Evidencia / límite |
|---|---|---|
| SHA desplegado | NO VERIFICADO | Sin metadato de commit identificado; diferencia de portada no permite elegir un SHA |
| Proyecto/root directory/rama/entorno Vercel | NO VERIFICADO | Sin acceso al panel; no inferir datos por dominio ni nombres de chunks |
| Variables del panel Vercel | NO VERIFICADO | Mensaje cliente no equivale a leer configuración del proyecto |
| URL pública del backend | NO VERIFICADO | Solo ejemplos localhost localizados; no se inventó URL |
| /health de backend público | NO VERIFICADO | Sin URL identificada; no se consultó health de otro servicio |
| PostgreSQL cloud | NO VERIFICADO | No se accedió a instancia/consola; adopción documental de Neon no demuestra conexión |
| CORS efectivo | NO VERIFICADO | Código usa CORS_ORIGIN o localhost:3000; configuración/respuesta desplegada no consultada |

No se modifican las clasificaciones RN/pantallas/backend por observar una revisión
publicada no identificada. Los flujos autenticados y QA responsive/accesibilidad
siguen pendientes. Otras aplicaciones y localhost no forman parte de esta prueba.

## CI/CD relacionado — resultados históricos reconsultados el 14/11

- Último API CI de develop: [42688463114](https://github.com/Marilu-su/TakeAndGo/actions/runs/42688463114),
  09/11/2026 19:58:33 UTC, SHA 54b84064dc393477ec197c202a5ebd8a48b56aa8, success.
- Último API CI global/PR89: [42827448480](https://github.com/Marilu-su/TakeAndGo/actions/runs/42827448480),
  10/11/2026 13:45:32 UTC, SHA 7831234b2875c67c01daf81508b52e76e0e60b9b, success;
  no implica rama integrada ni despliegue de ese SHA.
- Último deploy-web devuelto: [42688463183](https://github.com/Marilu-su/TakeAndGo/actions/runs/42688463183),
  09/11/2026 19:58:33 UTC, SHA 54b84064dc393477ec197c202a5ebd8a48b56aa8, failure.
  Log reconsultado job 129401536191: npm ci EUSAGE por faltantes ajv@8.20.0,
  fast-uri@3.1.9, json-schema-traverse@1.0.0 y require-from-string@2.0.2 en lockfile.
  Pasos de build/deploy skipped. No hubo nueva ejecución de CI ni modificación del lock.

Este fallo no implica ausencia de despliegues previos o por otros mecanismos:
hay portada pública. API usa Node22/PG16 y frontend Node20/Vercel CLI latest; el
workflow frontend no ejecuta lint/tests explícitos. Configuración completa,
protecciones y limitaciones de DB en el [informe de infraestructura](T04-INFRAESTRUCTURA.md).

## Seguimiento para T08/T32

Severidad = prioridad funcional/operativa, no evidencia de vulnerabilidad o caída.
No se crearon issues ni se efectuaron correcciones en Vercel/GitHub/backend.

| ID | Evidencia y estado | Severidad justificada / impacto | Tarea | Verificación o resolución posterior |
|---|---|---|---|---|
| DEP-01 | URL backend, /health, PostgreSQL cloud y CORS efectivo: NO VERIFICADO; solo ejemplos localhost en README/.env.example y código | Alta para aceptación de demo: impide acreditar el circuito; no demuestra una caída ni un incidente de seguridad | T32 | Identificar servicio/URL/revisión; GET público /health e interpretar cuerpo, comprobar DB y CORS desde origen Vercel; registrar evidencia sin secretos. |
| DEP-02 | 13/11 y 14/11: navegador muestra NEXT_PUBLIC_API_URL no configurada; variables del panel NO VERIFICADO | Alta funcional: frontend observado no puede consultar API; causa de configuración/build por determinar | T08/T32 | Inspeccionar proyecto, entorno y disponibilidad de la URL durante build; corregir por tarea dueña y luego comprobar petición a API; no inventar valores. |
| DEP-03 | 14/11: GET /login, /registro, /buffets, /pedidos y /admin devuelve 404; las tres primeras ya el 13/11 | Alta funcional: rutas del código auditado no están disponibles en ese dominio | T32 | Identificar revisión y root directory; contrastar rutas publicadas con develop y repetir smoke de rutas tras resolver. |
| DEP-04 | SHA desplegado, proyecto/entorno, rama y variables de Vercel: NO VERIFICADO; portada diferente del código con accesos | Media de trazabilidad: impide vincular pruebas de código con producción y planificar rollback | T32 | Vincular deployment con proyecto, commit, raíz y entorno mediante evidencia del panel autorizado; no inferir SHA por nombre de chunk o x-vercel-id. |
| DEP-05 | Run 42688463183/job 129401536191: npm ci EUSAGE por entradas faltantes en lock; build/deploy skipped | Alta para pipeline: bloquea esa ejecución; no demuestra que nunca existieron otros despliegues | T08/T32 | Reproducir instalación con versiones del runner; alinear package/lock en tarea posterior y exigir build/deploy exitosos más smoke. |

Los IDs DEP-01–05 mantienen el seguimiento original, ampliado con la evidencia del
14/11. Primero identificar destino y versión; las modificaciones posteriores
corresponden a T08/T32 con autorización. No compartir secretos en documentación.
