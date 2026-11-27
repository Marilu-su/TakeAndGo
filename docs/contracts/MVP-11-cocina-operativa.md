# MVP-11 · Cocina operativa

[Issue #107](https://github.com/Marilu-su/TakeAndGo/issues/107) · T18 · TDD-0009. Con un pedido de prueba confirmado, el staff del buffet puede verlo en cola, iniciar su preparación y dejarlo disponible para retiro cuando corresponda. El recorrido se puede validar en paralelo con pagos.

## Contrato y operación

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/v1/stores/:storeId/kitchen/orders` | Pedidos `CONFIRMED` y `PREPARING` del buffet, ordenados por `promisedFrom` y luego `createdAt`. |
| POST | `/api/v1/stores/:storeId/kitchen/orders/:orderId/start` | Cambia `CONFIRMED` a `PREPARING`. |
| POST | `/api/v1/stores/:storeId/kitchen/orders/:orderId/finish` | Registra `preparedAt` y `preparedByUserId` conservando `PREPARING`. |

Se reutilizan la autenticación y la autorización de staff por buffet, el repositorio Prisma y los casos de uso existentes de cocina. Para personal de otro buffet, el GET y los POST devuelven `403`. Las transiciones inválidas o repetidas devuelven `409`.

La cola distingue **Confirmado**, **En preparación** y **Preparado**. La última etiqueta corresponde a `PREPARING` con `preparedAt`. Oculta la acción de finalizar e informa que el retiro aún no está habilitado. El horario de inicio de la ventana se muestra en `America/Argentina/Buenos_Aires`. Las acciones se bloquean de forma síncrona por pedido hasta que la interfaz aplica la recarga o muestra el error. Los errores de cocina aparecen en el pedido. Los de retiro siguen en el formulario QR/manual.

El proceso existente en `apps/api/src/index.ts` revisa los pedidos al arrancar y cada diez segundos. Activa `READY_FOR_PICKUP` si la preparación está registrada y se cumple `promisedFrom ≤ ahora < promisedTo`. La escritura revalida esas condiciones y la ventana vigente. Las ventanas ausentes o vencidas no se amplían automáticamente. La cola se actualiza con el botón **Actualizar cola** o después de una operación exitosa. Cuando el GET deja de devolver un pedido habilitado para retiro, su fila desaparece.

## Evidencia y reproducción

- **43** pruebas de cocina sin PostgreSQL y **67** del frontend, incluidas **4** DOM nuevas, aprobadas. ESLint sin advertencias, Next typegen, typecheck web y API, y build web aprobados con Node 24.22.0, npm 11.19.1 y Next.js 16.4.6.
- **2 integraciones PostgreSQL** ejecutadas, sin fallos ni omisiones. `kitchenPersistence.test.ts` verificó preparación, actor y fecha persistidos, rechazo de finalización repetida, conservación de la ventana y activación. `kitchenQueueWorker.integration.test.ts` ejecutó GET y POST reales para dos buffets, comprobó el orden y aislamiento, observó `PREPARING` tras un ciclo antes de la ventana y comprobó `READY_FOR_PICKUP` en PostgreSQL y la desaparición de la fila en el GET siguiente.

Para reproducir las dos integraciones en PowerShell, usar un PostgreSQL 16 descartable verificado en `127.0.0.1:5434/takeandgo`, con rol exclusivo y migraciones del repositorio aplicadas. El test del proceso periódico exige el marcador SQL `takeandgo.mvp09_t08` con valor `takeandgo-mvp09-t08-postgres`. Verificar por SQL la base, el rol, el marcador y las migraciones antes de ejecutar las pruebas. Proporcionar `DATABASE_URL` mediante el entorno del proceso con credenciales de prueba. Desde `apps/api`, ejecutar:

```powershell
$env:DOTENV_CONFIG_PATH = 'NUL'
Remove-Item Env:DOTENV_CONFIG_OVERRIDE -ErrorAction SilentlyContinue
$env:PAYMENT_PROVIDER = 'fake'
$env:NODE_ENV = 'test'
$env:MVP11_KITCHEN_INTEGRATION = '1'
node --import tsx --test test/kitchen/kitchenPersistence.test.ts test/kitchen/kitchenQueueWorker.integration.test.ts
```

Confirmar dos aprobadas y cero omitidas. El test del proceso periódico utiliza JWT y JWKS locales y abre sus servidores únicamente en loopback. Las pruebas crean y limpian sus propios fixtures. Detener el contenedor descartable al finalizar. La suite general de API descubre el archivo nuevo con el patrón habitual y lo omite si `MVP11_KITCHEN_INTEGRATION` no está habilitada. La prueba de persistencia existente conserva su guard para la URL local.

## Límites

El backend de producción, el formulario QR/manual, los estados de dominio, las migraciones y las dependencias se conservaron. La cola web mantiene actualización manual, sin polling. Venta presencial, CocIA completa y replanificación quedan fuera de MVP-11. La validación en navegador real y en el entorno público sigue pendiente.
