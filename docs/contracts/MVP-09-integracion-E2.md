# MVP-09 · Integración con PostgreSQL descartable

## Estado de E.2

E.2 acumula **99 pruebas aprobadas**, 75 casos de backend, 19 de frontend y 5 integraciones PostgreSQL, con cero fallos y cero omisiones en las suites ejecutadas. Typecheck de API, compilación de la suite de integración, Next typegen, typecheck web y build web completaron correctamente. El build generó 15 de 15 páginas.

Al retomar E.2, Docker Desktop respondió en el contexto `desktop-linux`. Se creó exclusivamente `takeandgo-mvp09-e2-postgres` con PostgreSQL 16. El puerto asignado fue `127.0.0.1:52748`. Antes de escribir, una conexión desde el host verificó por SQL la versión del servidor, el nombre de base, el rol y el marcador exclusivo. Prisma y las suites recibieron el mismo `DATABASE_URL` de proceso, con la lectura de dotenv dirigida a `NUL`. La comprobación confirmó que dotenv no cambió la conexión.

Se aplicaron las 20 migraciones existentes con `db:deploy`. El seed cargó Buffet Sistemas (SIS001) con tres categorías, tres productos y dos adicionales. Pasaron **5 integraciones, con 0 fallos y 0 omitidas**:

| Integración | Evidencia comprobada |
| --- | --- |
| A · Stock insuficiente | Catálogo y ventanas devolvieron 200. Pedir dos unidades con saldo uno devolvió `409 INSUFFICIENT_STOCK`. Quedaron cero pedidos y movimientos, con saldo disponible 1 y reservado 0. |
| B · Pedido con ventana | El POST devolvió `201 RESERVED` y el GET de detalle devolvió 200 con los mismos campos de ventana y vencimiento. PostgreSQL registró un pedido, saldo disponible 0, reservado 1 y un movimiento `ORDER_RESERVED` de −1 vinculado al pedido. |
| C · Ventana vencida | El POST devolvió `409 PICKUP_WINDOW_UNAVAILABLE`. Quedaron cero pedidos y movimientos, con saldo disponible 1 y reservado 0. |
| Catálogo existente | Se armó el catálogo real y se verificó la autorización por buffet. |
| Concurrencia, atomicidad y rollback | Dos reservas concurrentes compitieron por una unidad. Solo una prosperó y quedó un único pedido. La cancelación repuso el saldo sin duplicar el movimiento de cancelación. |

En B, se verificó `scheduledForDate=2026-11-27T00:00:00.000Z`, ventana `2026-11-28T00:19:00.000Z`–`00:24:00.000Z`, tolerancia hasta `00:29:00.000Z` y reserva hasta `00:04:00.000Z`, cinco minutos después del reloj fijo. Al finalizar se detuvo únicamente el contenedor de E.2. Quedaron conservados su volumen, las migraciones y el seed. Las pruebas limpiaron sus fixtures. No se repitieron los tests unitarios ni el build.

## Preparar una instancia aislada

Ejecutar en una sesión nueva de PowerShell desde la raíz del repositorio, con acceso al daemon. Si ya existe el nombre indicado, detenerse y revisar su origen antes de seguir. El siguiente bloque es para la primera creación.

```powershell
$container = 'takeandgo-mvp09-e2-postgres'
$env:POSTGRES_DB = 'takeandgo_mvp09_e2'
$env:POSTGRES_USER = 'mvp09_e2_runner'
$env:POSTGRES_PASSWORD = [guid]::NewGuid().ToString('N')

docker run --detach --name $container --publish '127.0.0.1::5432' `
  --env POSTGRES_DB --env POSTGRES_USER --env POSTGRES_PASSWORD `
  postgres:16 -c "takeandgo.mvp09_e2=$container"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el contenedor exclusivo' }

$binding = docker port $container 5432/tcp
$portStatus = $LASTEXITCODE
$match = [regex]::Match(($binding -join "`n"), '^127\.0\.0\.1:([0-9]+)$')
if ($portStatus -ne 0 -or !$match.Success) {
  throw 'La publicación del puerto no es exclusivamente local'
}
$port = $match.Groups[1].Value
if ([int]$port -le 1024 -or $port -eq '5432') { throw 'Se requiere un puerto de prueba exclusivo' }
$env:DATABASE_URL = "postgresql://${env:POSTGRES_USER}:${env:POSTGRES_PASSWORD}@127.0.0.1:${port}/${env:POSTGRES_DB}"
```

Comprobar que PostgreSQL acepta conexiones con `docker exec $container pg_isready`. Desde `apps/api`, usar el mismo `DATABASE_URL` que recibirán Prisma y las pruebas, y verificar la identidad por SQL antes de escribir:

```powershell
@'
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    await client.connect();
    const { rows: [row] } = await client.query(
      "SELECT current_database() AS db, current_user AS role, current_setting('takeandgo.mvp09_e2', true) AS marker"
    );
    if (row.db !== 'takeandgo_mvp09_e2' || row.role !== 'mvp09_e2_runner' ||
        row.marker !== 'takeandgo-mvp09-e2-postgres') throw new Error('Identidad inesperada');
    console.log('Identidad de PostgreSQL descartable verificada');
  } finally {
    await client.end();
  }
})().catch(() => { console.error('No se verificó la instancia descartable'); process.exitCode = 1; });
'@ | node
if ($LASTEXITCODE -ne 0) { throw 'Detenerse antes de ejecutar migraciones o tests' }
```

Mantener las variables en esa sesión, sin escribirlas en archivos. `prisma7.config.ts` y las integraciones existentes cargan `dotenv/config`, que conserva una variable de proceso ya definida por defecto. Retirar cualquier ajuste de sobreescritura de dotenv de la sesión y volver a verificar la identidad si cambia la conexión. La integración nueva exige además un opt-in y valida el marcador, nombre de base y rol antes de crear fixtures.

## Migrar y ejecutar

Desde `apps/api`, correr cada comando únicamente si el anterior completó bien. Para ejecutar el seed, usar una sesión donde `tsx` esté operativo. Si aparece el fallo de Windows `uv_os_get_passwd: ENOMEM`, usar la misma precarga temporal en memoria de la regresión.

```powershell
npm.cmd run db:deploy
npm.cmd run db:seed
$env:RUN_MVP09_POSTGRES = '1'
.\node_modules\.bin\tsx.cmd --test test/modules/catalog/infrastructure/storeCatalogIntegration.test.ts test/orderReservationIntegration.test.ts test/modules/order/mvp09Postgres.test.ts
```

- **A:** verifica el catálogo y las ventanas de SIS001, pide dos unidades con saldo uno y exige `409 INSUFFICIENT_STOCK` sin pedidos, saldos ni movimientos nuevos.
- **B:** reserva una unidad, exige `201 RESERVED`, comprueba la ventana y los cinco minutos de reserva en la respuesta y el detalle, y verifica el movimiento de stock.
- **C:** pide una ventana vencida y exige `409 PICKUP_WINDOW_UNAVAILABLE` sin pedido ni reserva nuevos.

Los casos usan clientes con membresía, productos y saldos separados y un reloj fijo. La suite limpia sus fixtures al terminar y conserva SIS001 y su catálogo. Las integraciones existentes complementan el recorrido con catálogo, concurrencia, rollback y cancelación idempotente. Al terminar, usar `docker stop takeandgo-mvp09-e2-postgres` únicamente para el contenedor del ensayo. Para reabrirlo, usar `docker start takeandgo-mvp09-e2-postgres`, volver a comprobar la publicación del puerto y verificar la identidad por SQL. Conservar sus credenciales de forma segura para la siguiente sesión.

## Navegador y pendientes

Las pruebas HTTP inyectan un `ActorResolver` de prueba y usan los repositorios reales. Para el navegador, iniciar los servicios locales con la conexión verificada, apuntar la web al backend local y usar un cliente de un entorno de autenticación autorizado con membresía en SIS001. Preparar un producto visible con saldo finito para esa sesión. El flujo normal de login usa Neon Auth y no se identificó un login local seguro disponible. La prueba de navegador queda pendiente de autorización para usar un proveedor de prueba. No se introdujeron bypasses de autenticación.

- **BLOCKER de capacidad de cocina:** las ventanas acreditan factibilidad temporal y horaria. La validación de compromisos y capacidad real sigue pendiente.
- **Verificación pública:** depende de MVP-02. Confirmar que `SIS001` exista, esté activo y sea el buffet asignado para la demostración pública.
- **Instalación web:** la instalación manual desde PowerShell completó `npm ci` con el lockfile intacto. Los errores de certificados npm dejaron de bloquear el desarrollo. La causa original sigue sin determinarse.
- **Hallazgos medios fuera de alcance:** la comprobación de activación del buffet puede quedar desactualizada mientras se espera el bloqueo. El fallback interno sin adaptador transaccional y la falta de idempotencia del POST siguen documentados. E.2 limita la corrección al refresco de ventanas al abrir el resumen.
