# C3-01 — Contrato, endpoint e interfaz de MenIA

Implementación sobre `origin/develop` en `54b8406`, en la rama `codex/C3-01-menia`.
La especificación suministrada para C3-01 delimita esta entrega: comunicación vertical
sin LLM, herramientas de catálogo, recomendaciones, pedidos ni historial persistente.
No se encontraron el MASTER ni un TDD de MenIA en este checkout. Se respetan los
ADRs existentes y las reglas incluidas en la solicitud. Revisión humana pendiente.

## Recorrido funcional

Mis buffets → seleccionar un buffet activo → Abrir MenIA → escribir → Enviar.
También existe acceso desde el catálogo. El inicio global del cliente no cambia.

La pantalla obtiene el nombre real del buffet y el identificador de su organización.
No hay una consulta pública de nombre de organización en los contratos utilizados,
por lo que se muestra su identificador como referencia, sin inventar un nombre.

El chat muestra mensajes del usuario a la derecha y respuestas a la izquierda,
con área desplazable, estilos para celular, envío con Enter y salto con Shift+Enter.
Muestra carga, envío, errores, reintento y denegación de acceso. El historial vive
solo en memoria de la pantalla y se reinicia al cambiar de buffet o abandonarla.
No se envía un mensaje al abrir la pantalla.

## Backend

- `src/modules/menia/domain/conversation.ts`: contratos de contexto, mensaje, tarjetas y acciones.
- `src/modules/menia/application/ports.ts`: puertos de consulta y respuesta.
- `src/modules/menia/application/meniaUseCases.ts`: autorización, contexto y envío.
- `src/modules/menia/infrastructure/deterministicResponder.ts`: respuesta fija y explícita sobre el alcance actual.
- `src/modules/menia/infrastructure/meniaModule.ts`: composición con contratos públicos de Customer y Organization.
- `src/modules/menia/infrastructure/http/meniaRoutes.ts`: rutas y traducción acotada de errores del parser JSON.
- `src/app.ts`: registro del módulo con dependencias reemplazables en pruebas.
- `test/menia.test.ts`: pruebas HTTP y de aplicación.
- `test/fixtures/menia-server.cjs`: servidor exclusivo de integración frontend, sin base de datos y con identidad de prueba.

Las rutas, con respuestas `Cache-Control: no-store`, son:

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/stores/:storeId/menia/context` | Obtiene datos del buffet sin iniciar conversación. |
| POST | `/api/v1/stores/:storeId/menia/messages` | Envía un mensaje y recibe una respuesta. |

Request POST: `{ "message": "Hola" }`.

Response POST:

```json
{
  "message": { "role": "assistant", "text": "Respuesta determinística que informa que la interpretación inteligente se incorporará próximamente." },
  "cards": [],
  "actions": [],
  "context": {
    "storeId": "identificador-del-buffet",
    "storeName": "Nombre obtenido del backend",
    "organizationId": "identificador-de-la-organizacion"
  }
}
```

Solo se acepta un objeto JSON con `message` de tipo string, no vacío y de hasta
2000 unidades UTF-16. Es un límite técnico de entrada compartido con la interfaz,
no una regla nueva de pedidos. Se recortan espacios exteriores después de validar.
Se rechazan campos adicionales, incluyendo identidades o buffets enviados en el cuerpo.

Se reutiliza `requireActor`: 401 sin sesión, 403 para otros roles, falta de asociación
o buffet no activo, 404 para buffet inexistente, 400 para requests inválidos y 500
genérico ante errores inesperados. La identidad del Customer procede del Actor.
MenIA solo recibe puertos de lectura y un respondedor: no accede a tablas de otros
módulos ni recibe dependencias para crear pedidos o modificar usuarios.

## Frontend

- Ruta: `src/app/(customer)/buffets/[storeId]/menia/page.tsx`.
- `src/components/menia-chat.tsx` y `.module.css`: pantalla y conversación.
- `src/lib/menia.ts`: cliente, validación de respuestas y estado temporal suscribible.
- Accesos mínimos en la página de buffets y `src/components/catalog.tsx`.
- Dependencias de desarrollo: React Testing Library y jsdom 26, compatible con Node 20.
- `test/helpers/load-ts.mjs`: ejecuta módulos TS/TSX reales con los aliases de Next en Node test.
- `test/menia.test.mjs` y `test/menia-component.test.mjs`: estado, componentes e integración HTTP.

Se reutiliza `sessionRequest`; no se implementa otra autenticación. Se bloquean
envíos duplicados mientras hay una solicitud pendiente. Los reintentos no duplican
el mensaje del usuario. Una respuesta de otro buffet o con estructura inválida
no se incorpora al chat. Tarjetas y acciones quedan reservadas para siguientes tareas,
sin renderizar ni ejecutar funcionalidades futuras en esta entrega.

## Validación ejecutada

- Backend: `node node_modules/tsx/dist/cli.mjs --test test/menia.test.ts`: 10 aprobados.
- Backend completo: `node node_modules/tsx/dist/cli.mjs --test "test/**/*.test.ts"`:
  339 tests, 336 aprobados, 0 fallidos y 3 omitidos por sus condiciones existentes de PostgreSQL local.
- Una ejecución anterior tuvo una colisión aleatoria de `Store.code` en una prueba
  existente de catálogo. La repetición completa pasó sin cambiar esa prueba ni borrar datos.
- `npm run typecheck` backend: bloqueado por el archivo local previo, sin seguimiento,
  `src/modules/customer/application/associateCustomerToStore.test.ts`. Carece de
  `findByAuthUserId` y `authUserId`. Se preservó intacto. El programa TypeScript del
  código de la entrega, excluyendo únicamente ese archivo local, tiene cero diagnósticos.
- Frontend completo: `npm test`: 24 aprobados, 0 fallidos y 0 omitidos.
- Frontend: `npm run typecheck` y `npm run build -- --webpack`: correctos.
- Frontend: ESLint sobre todos los archivos TS/TSX y tests agregados/modificados: correcto.
- `npm run lint` completo: mantiene un error previo `react-hooks/set-state-in-effect`
  en `src/app/(auth)/alta-cliente/page.tsx:11`. No se modificó ese flujo ajeno.
- Las pruebas de React verifican envío, Enter/Shift+Enter, carga, error, reintento,
  acceso desde selección de buffet, ausencia de almacenamiento y cambio de contexto.
- Integración automatizada: componente React → `sessionRequest` → HTTP real → Express
  → caso de uso → adaptador → respuesta visible. Se utiliza un token y puertos de
  identidad/datos de prueba; no equivale a un recorrido manual con una cuenta Neon real.
- La revisión de estilos contempla anchos móviles y textos extensos. No se produjo
  una captura ni se afirma una validación visual en navegador o dispositivo real.

Para ejecutar los tests frontend completos instalar primero las dependencias de ambos
proyectos (`npm ci` en `apps/api` y `apps/web`) y ejecutar `npm test` en `apps/web`.
La integración inicia y detiene su propio servidor local, sin usar la API de desarrollo.

## Continuación en C3-02

Implementar `MeniaResponder` en un adaptador LLM y seleccionarlo en `meniaModule.ts`.
La ruta y la pantalla siguen utilizando el mismo contrato. La validación de la salida
del proveedor, tiempos de espera, límites y errores externos pertenecen a C3-02.
No se incorporaron migraciones ni persistencia, ni cambios en pagos, cocina o stock.
