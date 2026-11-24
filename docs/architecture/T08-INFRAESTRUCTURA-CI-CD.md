# T08 — Infraestructura y CI/CD

## Alcance y fuentes

El [Master V2.0](../reference/v2/TAKEANDGO_MASTER_V2_0.md) define las RN-001–010 y el flujo de ramas. El [plan oficial T08 y T32](../reference/planning/TAKEANDGO_PLAN_VERIFICADO_REPO_2026-11-12.md) fija el alcance y los criterios de cierre. Las [pantallas V2.0](../reference/v2/PANTALLAS_V2_0.md), el [ADR de infraestructura](ADR-0001-cloud-stack.md), el [ADR de autenticación](ADR-0002-autenticacion.md), la [auditoría T04](../audits/T04-RESUMEN-EJECUTIVO.md) y el [registro de decisiones con IA](../../AI-DECISIONS.md) conservan el contexto y las evidencias.

Los [TDD-0001–0014](../reference/v2/tdds/TDD_INDEX_V1.md) son referencias versionadas en borrador. [El directorio de TDD aprobados](../tdds/) conserva solo el marcador de Git. Queda pendiente que el equipo revise y promueva los TDD concretos que correspondan. Las referencias a V3 en borradores no sustituyen al Master V2.0.

## Ramas, PR y aprobaciones

- Crear ramas por tarea desde `develop` actualizado y usar Conventional Commits conforme a [CONTRIBUTING](../../CONTRIBUTING.md). `develop` integra el trabajo y `main` recibe las promociones de release.
- Abrir un PR a `develop` con alcance, TDD/RN cuando aplique, evidencia y límites. Pedir revisión cruzada de otra persona del equipo. Obtener al menos una aprobación y un resultado exitoso de `PR checks` antes de integrar.
- Promover con un PR de release desde `develop` hacia `main`. Registrar SHA, cambios, migraciones, evidencia de integración, smoke checks previstos y versión de rollback. Verificar que el SHA aprobado sea el promovido.
- Propuesta para ambas ramas: exigir PR y una aprobación cruzada, descartar aprobaciones obsoletas cuando cambie el diff, exigir resolución de conversaciones y el contexto `PR checks` de GitHub Actions, bloquear force-push y eliminación, y limitar excepciones administrativas. Confirmar el nombre del contexto en un PR antes de activar la regla. Considerar revisión de propietarios para cambios en `.github/workflows/` y `.github/ci/`.
- Estado: protecciones, rulesets y contexto obligatorio pendientes de aprobación y activación. Hace falta verificar su aplicación en cada rama.

## CI y runtime

Ambas aplicaciones usan Node **24.22.0** y npm **11.19.1** en CI. [`.node-version`](../../.node-version) fija Node y cada `package.json` declara npm en `packageManager`. La API declara el parche exacto y la web admite Node `24.x` en `engines`. Para reproducir los jobs, instalar las versiones fijadas y ejecutar `npm ci` por aplicación con sus lockfiles versionados.

| Componente | Alcance y resultado |
| --- | --- |
| [PR CI](../../.github/workflows/pr-ci.yml) | Todo PR a `develop` o `main`. Compara el resultado sintético del merge con su primer padre y selecciona suites. El job `PR checks` corre después de la selección y de las suites, incluso si hay fallos u omisiones. |
| [API CI](../../.github/workflows/api-ci.yml) | Workflow reutilizable para PR y comprobación tras push relevante a `develop`. PostgreSQL 16 aislado por job en `127.0.0.1:5434/takeandgo`. Instala dependencias y genera Prisma Client, corre typecheck y build, aplica migraciones y ejecuta tests. |
| [Web CI](../../.github/workflows/web-ci.yml) | Workflow reutilizable para PR. Instala dependencias, ejecuta ESLint con cero advertencias, genera tipos de Next, corre typecheck y tests, y compila con `npm run build`. Usa valores ficticios. |
| [Deploy web](../../.github/workflows/deploy-web.yml) | El workflow vigente hace build y deploy de Vercel con `--prod` ante push web relevante a `develop` y por ejecución manual. La promoción a `main` todavía no controla ese despliegue. |

`apps/api/**` y `api-ci.yml` seleccionan API. `apps/web/**`, `web-ci.yml` y `deploy-web.yml` seleccionan web. Cambios mixtos, `.node-version`, `.gitattributes`, archivos del orquestador y rutas desconocidas seleccionan ambas. La documentación bajo `docs/` y Markdown fuera de `.github/` se omiten de la selección. Las rutas se leen delimitadas por NUL y los renombres se evalúan como alta y baja para cubrir ambos lados.

El check exige una selección exitosa y `success` explícito de cada suite aplicable. Una suite no aplicable debe figurar como `skipped`. Un PR documental pasa porque la selección termina con éxito y ninguna suite aplica. Una suite aplicable omitida, fallida, cancelada o sin resultado bloquea el check. El workflow de PR tiene permisos de lectura y los checkouts de CI desactivan la persistencia del token. Cuando GitHub no puede crear el resultado del merge por conflictos, primero hay que resolverlos. Para PR de forks pueden aplicar aprobaciones de ejecución de GitHub.

## Entornos y variables

| Entorno | Configuración y uso |
| --- | --- |
| Desarrollo | API local en `3001`, web en `3000`, PostgreSQL y Auth de desarrollo. Cada persona usa su configuración local. Aplicar migraciones y, cuando haga falta, cargar fixtures en una base descartable. |
| Integración | `develop` integra código. Actions valida con PostgreSQL efímero para API y valores ficticios para web. Para probar autenticación real, hace falta un entorno de integración aislado con API, datos y Neon Auth propios. Su aprovisionamiento y ejecución completa quedan pendientes. |
| Producción | Objetivo de promoción desde `main` con frontend, API, DB y Auth separados de integración. El workflow Vercel vigente usa producción desde `develop`. T32 debe establecer la separación y el disparador de release y verificar los servicios públicos. |

Plantillas: [API](../../apps/api/.env.example) y [web](../../apps/web/.env.example).

| Variable | Uso |
| --- | --- |
| `PORT`, `CORS_ORIGIN` | Puerto de API y origen web permitido por entorno. |
| `DATABASE_URL` | Conexión de API y Prisma. Guardar el valor real en el gestor de secretos del entorno. |
| `NEON_AUTH_URL`, `NEON_AUTH_BASE_URL` | URLs de Auth para API y servidor web. Apuntan al mismo ambiente de autenticación. |
| `NEON_AUTH_COOKIE_SECRET` | Secreto del servidor web, de al menos 32 caracteres y distinto en cada ambiente real. |
| `NEXT_PUBLIC_API_URL` | URL pública de API incorporada al build web. Su valor es visible para el navegador. |
| `NEXT_TELEMETRY_DISABLED` | Desactiva telemetría de Next en CI. |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` | Configuración del workflow de despliegue desde GitHub Secrets. |

Usar configuración local ignorada o gestores de secretos, con permisos mínimos, rotación y separación entre entornos. Evitar volcar valores o tokens en PR, logs o evidencias. En CI de PR, conservar credenciales efímeras de PostgreSQL y valores ficticios para web. El despliegue es un workflow separado y sus secretos quedan fuera del PR.

## Migraciones y seeds

En `apps/api`, con `DATABASE_URL` de una base descartable o del ambiente aprobado:

1. Ejecutar `npm ci` para instalar dependencias y generar Prisma Client.
2. Crear migraciones solo en desarrollo con `npm run db:migrate -- --name <nombre>` y revisar el SQL versionado en [Prisma](../../apps/api/prisma/).
3. Aplicar migraciones existentes con `npm run db:deploy` en integración y producción. En CI se aplican sobre PostgreSQL limpio antes de las pruebas.
4. Ejecutar `npm run db:seed` cuando se necesiten fixtures de desarrollo o demo. El [seed](../../apps/api/prisma/seed.ts) usa IDs y código de buffet fijos y `upsert` para conservar registros existentes. La ejecución repetida y la preparación de cuentas Auth requieren evidencia por separado. No ejecutar el seed de demo en producción.

## Despliegue y rollback

El procedimiento propuesto para el PR de release registra el SHA aprobado, el artefacto o despliegue previo, el responsable, el estado de migraciones y los smoke checks de API `/health`, web, login y roles. Aplicar migraciones con respaldo y plan de compatibilidad, desplegar versiones que puedan convivir durante la transición y verificar la URL pública, CORS, Auth y los flujos críticos del ambiente.

Ante una regresión, detener la promoción, registrar el incidente y volver al artefacto o despliegue anterior si el esquema sigue siendo compatible. Si la migración impide volver de forma segura, decidir con el responsable de datos entre una migración correctiva y restauración desde respaldo, evaluando pérdida de datos y ventana de recuperación. El workflow actual de Vercel y la API cloud requieren ensayo real del procedimiento. El paso de promoción y rollback automatizado queda para T32.

## Acceso, contraseña y roles

El ADR de autenticación registra una prueba histórica de registro, login, JWT y verificación JWKS. La suite web local y Chromium verificaron sesión simulada y recorridos con respuestas controladas. Los resultados no acreditan el flujo con el proveedor y cuentas reales de integración.

| Alcance | Evidencia y siguiente verificación |
| --- | --- |
| Alta y acceso CUSTOMER, RN-001–003 | Hay pantallas de registro/login y precarga de perfil verificada con API simulada. Verificar con una cuenta real de prueba unicidad de email, asociación inicial y acceso con la política de confirmación acordada. |
| Recuperación, RN-004 | Pendiente. No se localizó el recorrido web de recuperación en las pantallas de acceso revisadas. Confirmar el soporte y la configuración de correo y callback del entorno y validar solicitud, correo, vencimiento y cambio de contraseña con cuenta de prueba. |
| Membresías, RN-005–009 | El contrato de código y asociación consta en el Master. Verificar código válido e inválido, asociación inmediata y múltiples buffets de organizaciones distintas. |
| Provisionamiento y roles, RN-010 | Administración y cocina se probaron con actores simulados. Verificar provisionamiento inicial y accesos permitidos/denegados para CUSTOMER, STORE_EMPLOYEE, STORE_ADMIN y ORGANIZATION_ADMIN, incluido aislamiento entre buffets y organizaciones. |

Registrar por cada prueba real el ambiente, rol, SHA, resultado y evidencia sin PII, contraseñas ni JWT. La validación real está pendiente por falta de un entorno de prueba y cuentas verificadas en esta sesión. T34 cubre la QA ampliada de roles y flujos administrativos.

## Evidencia y pendientes

| Estado | Evidencia |
| --- | --- |
| Runtime, API CI y ajustes web versionados | `d09e5a8`, `d3b5726`, `5f05759` y `b81fb61`. |
| Pipeline frontend local | Contenedor Linux limpio con Node 24.22.0 y npm 11.19.1. Instalación, ESLint sin advertencias, typegen, typecheck, 13 tests, build con Turbopack y SHA-256 de lockfile intacto. Cuatro regresiones Chromium con API simulada. `actionlint` pasó sobre los dos workflows validados en `b81fb61`. |
| Check agregado | 27 pruebas locales de selección y resultado agregado, 6 comprobaciones del código de salida del gate, y parseo y comprobación estructural de los 4 YAML. Ejecución en Actions, actionlint de la configuración nueva y protección de las ramas pendientes. |
| Hallazgos de npm audit | 15 en la instalación web, incluidos 5 altos y 2 críticos. Pendiente separar dependencias de build y producción, directas y transitivas, y verificar versión, configuración y recorrido alcanzable antes de concluir si existe exposición. No se aplicaron actualizaciones masivas. |
| Fuentes web | `next/font/google` descarga Geist y Geist Mono durante el build. La compilación local pasó con acceso a Google Fonts. Para reproducibilidad sin cambiar el diseño, evaluar versionar exactamente las mismas variantes y subconjuntos con licencias y hashes y usar `next/font/local` en un cambio revisado. |

Para validar en Actions, publicar T08 y abrir un PR borrador a `develop` previa aprobación. Verificar en el SHA del PR la ejecución de ambas suites por el cambio compartido, el resultado de `PR checks` y el conteo de pruebas de persistencia ejecutadas. Probar por separado cambios solo de API, solo de web y documentales, y confirmar el bloqueo ante fallo u omisión de una suite seleccionada antes de exigir el contexto. Mantener evidencia de cada corrida y solicitar aprobación administrativa para las protecciones.

T32 toma la validación de Vercel y dominio/API cloud, la separación real de entornos, PostgreSQL y Auth gestionados, migraciones y secretos, proveedores de IA/STT y push, estrategia de jobs y persistencia tras reinicio, health y observabilidad, smoke checks, promoción y rollback automatizados. T08 queda pendiente de validación en GitHub, revisión humana, protecciones y evidencia de autenticación real.
