# T04 — Resumen ejecutivo de la auditoría

Consolidación: 14/11/2026, America/Buenos_Aires.
Rama: feature/T04-auditoria-cumplimiento. Base productiva develop:
`54b84064dc393477ec197c202a5ebd8a48b56aa8`. Autoridad funcional: Master V2.0.

## Dictamen y alcance

Se clasificaron las 184 RN y las 39 pantallas, se inspeccionaron 35 rutas HTTP,
59 archivos de tests y 329 declaraciones de prueba, además de GitHub/CI/CD y
la portada pública. Eso acredita alcance documental, no cumplimiento completo.
No hay evidencia para declarar terminado el recorrido digital ni operativa la demo.
No se calculan porcentajes ni se aprueban módulos por existir archivos o mocks.

| Área | Resultado / evidencia vigente |
|---|---|
| [184 RN](T04-MATRIZ-CUMPLIMIENTO.md) | 6 PROBADO, 35 PARCIAL, 23 PENDIENTE_VALIDACION, 10 PENDIENTE_INTEGRACION, 110 NO_LOCALIZADO |
| [39 pantallas](T04-FRONTEND.md) | 12 PARCIAL, 8 PENDIENTE_INTEGRACION, 2 PENDIENTE_VALIDACION, 17 NO_LOCALIZADO; ninguna plenamente validada |
| [Backend](T04-BACKEND.md) | 35 registros HTTP; release-expired deniega, pagos sin router y casos internos no equivalen a exposición |
| [Testing](T04-TESTING.md) | 59 archivos/329 declaraciones; 16 archivos con 23 pruebas PostgreSQL; no nueva suite completa en el cierre |
| [Infraestructura](T04-INFRAESTRUCTURA.md) | Consulta del 14/11: protecciones efectivas visibles deshabilitadas, PR89 abierto, MenIA no integrada |
| [Web pública](T04-DESPLIEGUE-PUBLICO-2026-11-13.md) | 13/11 y 14/11: portada 200 y mensaje NEXT_PUBLIC_API_URL; 14/11: cinco rutas de acceso/operación 404 |

RN-026 sigue PENDIENTE_VALIDACION: scope modelado y prueba DB existente no acreditan
por sí solos su ejecución individual. RN-112 es PARCIAL: permisos existentes no
certifican configuración CocIA ausente. Los seis PROBADO son circuitos acotados,
no seguridad total, integración externa ni producción. Responsive, accesibilidad
y recorridos autenticados siguen pendientes en las 39 pantallas.

## Ejecuciones, observaciones y límites

- Históricas locales del 12/11: API typecheck/build PASS; 306 PASS, 0 FAIL, 23 SKIP.
  Frontend 13 tests PASS, lint FAIL; build Turbopack FAIL local, Webpack PASS y
  typecheck posterior PASS. No son verificaciones intercambiables ni resultados nuevos.
- CI develop del 09/11: run 42688463114, 326 PASS/3 SKIP documentados históricamente.
  CI PR89 del 10/11: run 42827448480 success reconsultado el 14/11, sin atribuirle
  ese conteo de develop. Tres pruebas DB se omiten por guard 5434/takeandgo frente
  a 5432/takeandgo_test en CI. Snapshots no sustituyen logs TAP completos.
- B07: dos caracterizaciones en memoria documentadas el 13/11; PASS reproduce el
  retry bloqueado, no un reembolso correcto. En cierre reducido solo se autoriza
  repetir esa prueba segura y verificaciones documentales, sin DB ni proveedor.
  Repetición del 14/11: 2 PASS, 0 FAIL, 0 SKIP; reproduce el defecto, no lo soluciona.
- Deploy-web run 42688463183 del 09/11 falla en npm ci por lock; build/deploy skipped.
  Su reconsulta del 14/11 no es una ejecución nueva. Existe portada publicada,
  posiblemente por otro despliegue: no se identificó su SHA.
- SHA publicado, panel/variables Vercel, URL backend, /health público, PostgreSQL
  cloud y CORS efectivo: NO VERIFICADO. El texto de UI no demuestra backend caído.
- npm audit producción conserva 13 paquetes afectados (6 low, 5 high, 2 critical)
  como resultado histórico. No demuestra explotabilidad actual ni incidente P0.

## Hallazgos y tareas responsables

Niveles: confirmado por código; caracterizado con fakes; riesgo estático pendiente
de reproducción; externo NO VERIFICADO. La prioridad indica impacto en cierre,
no una vulnerabilidad demostrada. Responsables según plan: Brenda, Maca y Lauti;
para T04/T08/T12/T16/T20/T24/T28/T32/T36 figura «Yo», identificado en esta auditoría
como Luana (solicitante); corresponde al equipo confirmar la asignación nominal.

| Hallazgo / impacto | Nivel / RN | Tarea y responsable | Próximo paso |
|---|---|---|---|
| Reserva 15 minutos frente a máximo 5 | Código confirmado; RN-070 | T14 Maca / T15 Lauti | Alinear pago/checkout y límites temporales; no cambiar regla |
| Expiración sin job y estado EXPIRED | Código confirmado; RN-061,074–075 | T14 Maca / T32 Luana; apoyo T11/T31 Lauti | Job durable, máquina de estados y pruebas en DB dedicada |
| Pago sin router/proveedor/webhook | Código confirmado; RN-068–077 | T14 Maca / T15 Lauti | Integrar circuito y verificar en sandbox autorizado |
| B07: PENDING bloquea retry tras fallo | Caracterización en memoria; RN-075,077 | T14 Maca / T31 Lauti | Diseñar reconciliación/idempotencia, sin devoluciones ciegas |
| Retiro sin guard de ventana/tolerancia | Ausencia en código; efecto DB por reproducir; RN-115–116,120 | T19 Lauti / T22 Maca / T31 Lauti | Validar tiempos en transacción y concurrencia real |
| Stock sin balance y cambio concurrente de catálogo | Riesgos estáticos B05/B06; RN-079–084,031–032,043 | T03/T07/T11/T19/T31 Lauti | Reproducir y cerrar consistencia; no afirmar exploit |
| Registro sin buffet y recovery incompleto | Código; RN-002,004 | T05 Brenda / T08 Luana | Completar y validar identidad/asociación con cuentas reales |
| Horarios/capacidad/predictor y módulos posventa pendientes | Ausencia localizada; RN-054–059,085–106,120–184 | T06 Maca; T11 Lauti; T12/T16/T20 Luana; T22 Maca; T23 Lauti; T24 Luana; T26 Maca; T27 Lauti; T28 Luana | Resolver por tareas funcionales, sin declarar cumplimiento de reglas negativas |
| Protecciones/reviews/checks no exigidos en controles visibles | Consulta 14/11; reglas técnicas | T08 Luana | Acordar enforcement y verificar configuración; detalle administrativo 403 no verificado |
| CI/lock/versiones y cobertura incompleta | Logs/workflows; no reproducción nueva | T08/T32 Luana | Alinear entorno/instalación/checks sin omitir guards de seguridad |
| Portada 200, cinco rutas 404 y API URL ausente en circuito observado | GET/navegador 14/11; DEP-01–05 | T08/T32 Luana | Identificar proyecto/SHA/URL; después verificar health, DB, CORS y rollback |
| ADR de proveedor pago, LLM/STT, predictor, push y jobs | Decisiones pendientes, no proveedores inferidos | T14 Maca; T09/T17 Brenda; T16/T24/T32 Luana | Elegir/documentar por tarea dueña, sin secretos |
| V3 en TDD borrador y ambigüedad de QR reutilizado | Fuentes preservadas, no nuevas RN | T08 Luana / T19 Lauti | Aclarar contratos y autoridad V2 sin reescribir originales |

## Trabajo fuera de BASE

| Trabajo | Referencia | Tarea |
|---|---|---|
| PR89 abierto, sin reviews en consulta 14/11 | feature/C2-frontend-rutas-base@7831234b2875c67c01daf81508b52e76e0e60b9b | T02 Maca; integrar no completa automáticamente todas sus pantallas |
| MenIA determinística, no LLM completo | feature/C3-01-menia@fae7add08f318e6a554947067328bdf3049bb1b4 | T01/T09/T13/T17/T21 Brenda |
| E2E cocina/retiro | feat/C2-20-e2e-kitchen-pickup@3c21a2d16a3590e43c22f6e843bdd521d9f05328; también en feat/C2-19-pickup@a65c40f44e41e284688485bfca7752b90373b912 | T03/T31 Lauti; no ejecutado ni contado entre los 329 |

## Estado de entrega y cierre

Cuatro commits aprobados y realizados: 7c524db, 5a6a307, de8a43d y afbb927.
El cierre reducido propone 27 archivos nuevos y un script modificado, sin incluir
siete copias auxiliares ni AI-DECISIONS.md raíz. Veinte fuentes originales conservan
sus hashes; los snapshots del 12/11 y 13/11 no se presentan como actuales.
Las fuentes y los TDD son accesibles mediante el [índice](README.md#fuentes-preservadas).

T04 no se marca DONE administrativo ni producto terminado: falta aprobar/versionar
este cierre y realizar el PR/revisión cuando el usuario autorice. El plan contempla
issues/matriz, política de merge y estado de producción; los issues no se publicaron,
la política efectiva y producción siguen con límites explícitos. Corregir o aceptar
esos bloqueos requiere decisión humana, no simular validación externa.

Las correcciones funcionales quedan en T01–T35 y la certificación final en T36.
La auditoría puede entregarse con brechas explícitas; no se transfieren a PASS ni se
hacen despliegues/migraciones para cerrar documentación. Las validaciones finales
del cierre deben reportarse como documentales o caracterización, nunca suite integral.
