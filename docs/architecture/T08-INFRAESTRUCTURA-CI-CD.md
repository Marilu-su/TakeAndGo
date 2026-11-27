# T08 — Infraestructura y CI/CD

## Alcance y fuentes

El [Master V2.0](../reference/v2/TAKEANDGO_MASTER_V2_0.md) define las RN-001–010 y el flujo de ramas. El [plan oficial T08 y T32](../reference/planning/TAKEANDGO_PLAN_VERIFICADO_REPO_2026-11-12.md) fija el alcance y los criterios de cierre. Las [pantallas V2.0](../reference/v2/PANTALLAS_V2_0.md), el [ADR de infraestructura](ADR-0001-cloud-stack.md), el [ADR de autenticación](ADR-0002-autenticacion.md), la [auditoría T04](../audits/T04-RESUMEN-EJECUTIVO.md) y el [registro de decisiones con IA](../../AI-DECISIONS.md) conservan el contexto y las evidencias.

Los [TDD-0001–0014](../reference/v2/tdds/TDD_INDEX_V1.md) son referencias versionadas en borrador. [El directorio de TDD aprobados](../tdds/) conserva solo el marcador de Git. Queda pendiente que el equipo identifique, revise y promueva los TDD concretos que correspondan. El pendiente consta en la [revisión del PR #96](https://github.com/Marilu-su/TakeAndGo/pull/96#pullrequestreview-6088919859) y se sigue en [MVP-03 / #99](https://github.com/Marilu-su/TakeAndGo/issues/99).

## Ramas, PR y aprobaciones

- Crear ramas por tarea desde `develop` actualizado y usar Conventional Commits conforme a [CONTRIBUTING](../../CONTRIBUTING.md). `develop` integra el trabajo y `main` recibe las promociones de release.
- Abrir un PR a `develop` con alcance, TDD/RN cuando aplique, evidencia y límites. Pedir revisión cruzada de otra persona del equipo. Obtener al menos una aprobación y un resultado exitoso de `PR checks` antes de integrar.
- Promover con un PR de release desde `develop` hacia `main`. Registrar SHA, cambios, migraciones, evidencia de integración, smoke checks previstos y versión de rollback. Verificar que el SHA aprobado sea el promovido.
- Propuesta para ambas ramas: exigir PR y una aprobación cruzada, descartar aprobaciones obsoletas cuando cambie el diff, exigir resolución de conversaciones y el contexto `PR checks` de GitHub Actions, bloquear force-push y eliminación, y limitar excepciones administrativas. Confirmar el nombre del contexto en un PR antes de activar la regla. Considerar revisión de propietarios para cambios en `.github/workflows/` y `.github/ci/`.
- El ruleset [Protección main y develop](https://github.com/Marilu-su/TakeAndGo/rules/23904079) está deshabilitado. Quedan pendientes en [MVP-03 / #99](https://github.com/Marilu-su/TakeAndGo/issues/99) la aprobación, activación y verificación por rama del PR cruzado y de `PR checks` obligatorio. El criterio de PR y CI exigibles de T08 sigue abierto hasta esa verificación.

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
| Recuperación, RN-004 | Bloqueada. Falta el recorrido web «Olvidé mi contraseña» y configurar el envío de correo y la URL de retorno en Neon Auth. Después, validar solicitud, entrega, vencimiento y cambio de contraseña con una cuenta de prueba. Queda fuera del MVP de la defensa. |
| Membresías, RN-005–009 | El contrato de código y asociación consta en el Master. Verificar código válido e inválido, asociación inmediata y múltiples buffets de organizaciones distintas. |
| Provisionamiento y roles, RN-010 | Administración y cocina se probaron con actores simulados. Verificar provisionamiento inicial y accesos permitidos/denegados para CUSTOMER, STORE_EMPLOYEE, STORE_ADMIN y ORGANIZATION_ADMIN, incluido aislamiento entre buffets y organizaciones. |

El [plan de T08](../reference/planning/TAKEANDGO_PLAN_VERIFICADO_REPO_2026-11-12.md#t08--asegurar-base-técnica-acceso-ci-documentación-y-entornos) admite un flujo de auth validado o con un bloqueo específico. RN-004 sigue sin validación funcional y queda asentado como el bloqueo específico de ese criterio. T34 cubre la QA ampliada de roles y flujos administrativos.

## Evidencia y pendientes

| Estado | Evidencia |
| --- | --- |
| Runtime, API CI y ajustes web versionados | `d09e5a8`, `d3b5726`, `5f05759` y `b81fb61`. |
| Pipeline frontend local | Contenedor Linux limpio con Node 24.22.0 y npm 11.19.1. Instalación, ESLint sin advertencias, typegen, typecheck, 13 tests, build con Turbopack y SHA-256 de lockfile intacto. Cuatro regresiones Chromium con API simulada. `actionlint` pasó sobre los dos workflows validados en `b81fb61`. |
| Check agregado | 27 pruebas locales y en Actions; seis comprobaciones locales del código de salida del gate; parseo estructural y actionlint 1.7.7 sobre los cuatro workflows. Protecciones pendientes. |
| Hallazgos de npm audit | Web pasó de 15 a 12 entradas tras la actualización acotada de Next.js, Sharp y source-map-js. El árbol web sin desarrollo pasó de 8 a 5. API conserva 3 altas encadenadas a un mismo aviso de Effect. Ver alcance y decisiones abajo. |
| Fuentes web | `next/font/google` descarga Geist y Geist Mono durante el build. La compilación local pasó con acceso a Google Fonts. Para reproducibilidad sin cambiar el diseño, evaluar versionar exactamente las mismas variantes y subconjuntos con licencias y hashes y usar `next/font/local` en un cambio revisado. |

La última corrida completa de [PR CI del #96](https://github.com/Marilu-su/TakeAndGo/actions/runs/46006358277) validó `ec6315fa0b4aa92288ed18cfbf2e5df0248acb2b` tras integrar `develop`. Pasaron Detectar cambios (27 pruebas del selector y del check), API (tipos, build, migraciones y tests), Web (lint, typegen, tipos, tests y build con el lockfile actualizado) y `PR checks`.

Las pruebas de selección cubren PR solo API, solo frontend, mixtos, documentales y de infraestructura compartida. También cubren fallo, cancelación, omisión inesperada y resultado ausente. GitHub ejecutó esas pruebas en el selector del PR mixto y se observó la orquestación completa para ese PR. Queda pendiente observar las demás combinaciones a nivel de workflow con PR reales.

### Seed, acceso y roles

- **Seed repetido.** El equipo aplicó las migraciones de `develop` (`ec30ed82fda57cc81d7008b79868e559b6bb0ea7`) en PostgreSQL 16 descartable y ejecutó `db:seed` dos veces sobre la misma base, más una tercera ejecución de confirmación. Las tres terminaron sin errores y dejaron 1 organización, 1 buffet, 3 categorías, 3 productos y 2 adicionales.
- **Acceso y roles.** El equipo verificó 19 de 19 casos con API local de `develop` y cuentas de prueba en Neon Auth de desarrollo. Los casos de otro buffet u organización usaron IDs inexistentes. Los resultados cubren las comprobaciones de la tabla siguiente. El recorrido de alta, perfil CUSTOMER, asociación al buffet SIS001, pedido y pago en sandbox se verificó con cuenta real en MVP-07.

| Casos | Resultado observado |
| --- | --- |
| 3 sin sesión válida | Credenciales incorrectas, `GET /me` sin token y con token inválido devolvieron 401. |
| 5 de CUSTOMER | Login con `GET /me` y consulta de sus buffets devolvieron 200. Stock, cocina y administración de organización devolvieron 403. |
| 4 de STORE_EMPLOYEE | Login con `GET /me` y cocina de su buffet devolvieron 200. Cocina de otro buffet y administración de organización devolvieron 403. |
| 4 de STORE_ADMIN | Login con `GET /me`, stock y movimientos de su buffet devolvieron 200. Stock de otro buffet devolvió 403. |
| 3 de ORGANIZATION_ADMIN | Login con `GET /me` y buffets de su organización devolvieron 200. Buffets de otra organización devolvieron 403. |

La repetición de acceso y roles en el entorno de integración queda pendiente de disponer de una API, datos y cuentas de prueba en Neon Auth de ese entorno. La evidencia de desarrollo está registrada arriba. RN-004 requiere además el recorrido y la configuración descritos en [Acceso, contraseña y roles](#acceso-contraseña-y-roles).

### Alcance de npm audit

- **Remediado en el lockfile propuesto.** Next.js pasa de 16.3.6 a 16.4.6; su Sharp opcional de 0.35.4 a 0.35.5. `source-map-js` pasa de 1.2.1 a 1.2.4 dentro del rango vigente. Desaparecieron una entrada crítica y dos altas. En la revisión del código web no se encontraron usos explícitos de Draft Mode, `use cache`, `next/image` ni Server Actions; se actualizó el framework por su alcance y severidad. El lockfile también depuró entradas de peers opcionales de Ajv sin cambiar la versión de Neon Auth ni de Better Auth. [Avisos de Next.js](https://github.com/vercel/next.js/security/advisories) · [Sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) · [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
- **Web pendiente.** Quedan 1 crítica y 3 altas ligadas a Better Auth, los paquetes de Neon Auth y Zod, más 1 baja de Drizzle. Las 7 moderadas son de la cadena de ESLint y minimatch, ausentes al omitir desarrollo. La interfaz usa email y contraseña y no se encontró habilitación explícita de OAuth Proxy o Magic Link, pero el handler delega rutas al SDK y la configuración administrada del proveedor no fue verificada. Neon Auth 0.7.0-beta aún declara Better Auth 1.7.6. Se dejó pendiente una versión compatible del proveedor y la validación en integración; no se forzaron sus dependencias. [Better Auth](https://github.com/better-auth/better-auth/security/advisories) · [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- **API pendiente.** Las 3 entradas altas corresponden a Prisma → @prisma/config → Effect. Aparecen incluso con `--omit=dev` por la resolución del árbol que incluye a Prisma como peer de @prisma/client. La ruta identificada en el repo es la configuración y CLI de Prisma; no se estableció exposición por la API HTTP. @prisma/config 7.10.1 fija Effect 3.20.0. Se evitó el downgrade mayor sugerido por npm y un override fuera del pin sin validar generación, migraciones y pruebas de persistencia. [Aviso de Effect](https://github.com/advisories/GHSA-7589-6fvf-x4pw).

T32 toma la validación de Vercel y dominio/API cloud, la separación real de entornos, PostgreSQL y Auth gestionados, migraciones y secretos, proveedores de IA/STT y push, estrategia de jobs y persistencia tras reinicio, health y observabilidad, smoke checks, promoción y rollback automatizados. Para T08 quedan la revisión cruzada, la integración manual del PR, la verificación de las protecciones y la revisión de los TDD concretos.
