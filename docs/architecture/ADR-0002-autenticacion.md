# ADR-0002: Autenticación de usuarios

## Estado

Propuesto

## Contexto

Take&Go necesita identificar al usuario que realiza cada pedido a la API para aplicar las reglas de autorización ya implementadas en los módulos de organización, catálogo y customer. Hasta ahora, la API no identifica usuarios y todos los endpoints protegidos responden `401`.

Se distinguen dos responsabilidades:

- **Autenticación:** confirmar quién es el usuario (registro, inicio de sesión, contraseñas, sesiones).
- **Autorización:** decidir qué puede hacer ese usuario (por ejemplo, si puede modificar el catálogo de un buffet). Depende de los roles y de las asociaciones a buffets, que son reglas propias de Take&Go.

La consigna promueve el uso de servicios gestionados para reducir la carga operativa. Se buscó una opción que no requiera implementar ni mantener la seguridad de contraseñas, que tenga un plan gratuito suficiente para el MVP y que se integre con el backend existente (Node.js, Express, PostgreSQL en Neon).

## Alternativas consideradas

| Criterio | Neon Auth | Supabase Auth | Clerk | Autenticación propia (JWT) |
| --- | --- | --- | --- | --- |
| Plan gratuito | Hasta 60.000 usuarios activos por mes | Hasta 50.000 usuarios activos por mes | Hasta 50.000 usuarios retenidos por mes | Sin costo de servicio |
| Proveedor adicional | No (ya usamos Neon) | Sí | Sí | No |
| Pausa por inactividad en el plan gratuito | No | Sí, después de una semana | No | No |
| Ubicación de los usuarios | En nuestra base (esquema `neon_auth`) | En el proveedor | En el proveedor | En nuestra base |
| Seguridad de contraseñas y sesiones | Gestionada | Gestionada | Gestionada | Responsabilidad del equipo |
| Madurez | Integración en beta | Estable | Estable | Depende de la implementación |

La autenticación propia se descartó porque traslada al equipo responsabilidades de seguridad (almacenamiento de contraseñas, recuperación, sesiones) que no aportan valor diferencial al producto.

Supabase Auth y Clerk son opciones maduras, pero suman un proveedor externo a la arquitectura. Además, el plan gratuito de Supabase pausa los proyectos después de una semana sin actividad, lo que representa un riesgo para un proyecto con períodos sin uso entre entregas.

## Decisión

Se adopta **Neon Auth** (Managed Better Auth) como servicio de autenticación.

- El frontend registra e inicia sesión a los usuarios mediante Neon Auth y obtiene un JWT.
- El frontend envía el JWT a la API en el encabezado `Authorization: Bearer <token>`.
- La API verifica la firma del JWT con las claves públicas publicadas por Neon Auth (endpoint JWKS) y valida el emisor y la audiencia.
- El identificador del usuario (`sub` del JWT) se vincula con las entidades de Take&Go: un Customer o un rol de staff en un buffet.
- **Los roles y permisos se mantienen en el backend de Take&Go.** El rol que incluye el JWT de Neon Auth (`authenticated`) es genérico y no se usa para autorizar operaciones.

Antes de adoptar la decisión se realizó una prueba de integración: registro, inicio de sesión, obtención del JWT y verificación de su firma con el endpoint JWKS desde Node.js, con resultado exitoso.

## Consecuencias

### Positivas

- No se agrega un proveedor nuevo: autenticación y base de datos quedan en Neon.
- Los usuarios quedan en nuestra propia base de datos, sin dependencia de datos en un servicio externo.
- La API no maneja contraseñas: solo verifica JWT firmados.
- El punto de integración ya existe (`actorResolver`), por lo que los módulos de negocio no cambian.

### Negativas y mitigaciones

- **Integración en beta:** puede haber cambios en el servicio. Se mitiga porque la API solo depende del estándar JWT/JWKS, por lo que cambiar de proveedor implicaría modificar únicamente la verificación del token.
- **Registro abierto por defecto:** cualquier persona puede crear una cuenta. Se mitiga porque un usuario nuevo no tiene permisos hasta que se lo vincula con un Customer o un rol de staff.
- **Envío de correos:** para la recuperación de contraseña en producción se necesita configurar un proveedor de correo propio.
- **Entornos por branch:** cada branch de la base tiene su propio entorno de autenticación, por lo que los usuarios de desarrollo no existen en producción.

## Trabajo derivado

- Vincular los usuarios autenticados con sus Customers.
- Implementar el modelo de staff de cada buffet (rol y buffet de cada administrador o empleado).
- Reemplazar el `actorResolver` actual por uno que verifique el JWT y arme el Actor a partir de los datos de Take&Go.