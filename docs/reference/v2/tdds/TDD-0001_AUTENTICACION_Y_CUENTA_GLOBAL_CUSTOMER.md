---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0001 — Autenticación y Cuenta Global CUSTOMER

## 1. Contexto de negocio

### Objetivo
Implementar la identidad global del `CUSTOMER`: registro, login y recuperación de contraseña. La cuenta debe ser única en toda Take&Go y no depender de un buffet u organización particular.

### Roles involucrados
- `CUSTOMER`

### Reglas de negocio relacionadas
`RN-001` a `RN-004`; relacionadas para el alta inicial: `RN-005`, `RN-006`, `RN-007`.

### Alcance
- Registro con nombre, email, contraseña y código de buffet.
- Email único y comparación case-insensitive.
- Login y recuperación de contraseña.
- Cuenta habilitada sin verificación de email en el MVP.
- Coordinación con el módulo de asociación para crear la membresía inicial.

### Dependencias
- `TDD-0002` para validar código y crear asociación inicial.
- ADR de autenticación para elegir proveedor/adaptador productivo; no bloquea Domain/Application.

---

## 2. Criterios de aceptación

### CA-01 — Registro exitoso

**Dado** un usuario no registrado, datos válidos y un código de buffet válido  
**Cuando** solicita crear su cuenta  
**Entonces** se crea una única cuenta global CUSTOMER y la asociación inicial, sin exigir verificación previa de email

**RN relacionadas:** `RN-001`, `RN-002`, `RN-003`, `RN-007`

### CA-02 — Email case-insensitive y único

**Dado** que ya existe `Ivo@ejemplo.com`  
**Cuando** se intenta registrar `ivo@ejemplo.com`  
**Entonces** el registro es rechazado como email ya registrado y no se crea una segunda cuenta

**RN relacionadas:** `RN-001`

### CA-03 — Código inicial obligatorio

**Dado** un usuario no registrado  
**Cuando** intenta registrarse sin código de buffet o con un código inválido  
**Entonces** el registro no se completa y no queda una cuenta operativa parcial

**RN relacionadas:** `RN-002`, `RN-005`, `RN-006`, `RN-007`

### CA-04 — Login válido

**Dado** un CUSTOMER registrado  
**Cuando** presenta credenciales válidas  
**Entonces** el sistema autentica al CUSTOMER y entrega la sesión/credencial definida por el adaptador

**RN relacionadas:** `RN-001`

### CA-05 — Login inválido

**Dado** credenciales incorrectas  
**Cuando** se intenta iniciar sesión  
**Entonces** el acceso es rechazado sin crear sesión autenticada

**RN relacionadas:** `RN-001`

### CA-06 — Recuperación de contraseña

**Dado** un CUSTOMER registrado  
**Cuando** usa “Olvidé mi contraseña” con su email  
**Entonces** se inicia el flujo de recuperación y la nueva contraseña pasa a ser la válida al completarlo

**RN relacionadas:** `RN-004`

---

## 3. Diseño técnico

### Modelo de dominio
- `User`: identidad global y rol CUSTOMER.
- `Email` Value Object: normaliza al comparar/persistir para que mayúsculas/minúsculas no creen identidades distintas.
- La contraseña no pertenece al dominio como texto plano; se delega a `AuthPort`.

**Invariantes principales**
- Un email normalizado identifica como máximo una cuenta CUSTOMER.
- El alta requiere nombre, email, contraseña y al menos un código de buffet.
- La cuenta no depende de un tenant.
- La verificación de email no bloquea el uso del MVP.
- Nunca persistir contraseña en texto plano.

### Casos de uso
- `RegisterCustomer`
- `LoginCustomer`
- `RequestPasswordRecovery`
- `ResetPassword`

### Puertos requeridos
- `UserRepositoryPort`
- `AuthPort`
- `CustomerStoreMembershipPort`

### Contratos / API
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/password-recovery`
- `Contrato de reset definido por el adaptador/ADR sin cambiar la semántica funcional.`

### Persistencia
- `User(id, name, emailNormalized, role, authIdentityReference, createdAt, updatedAt)`.
- Índice UNIQUE sobre email normalizado.
- Las asociaciones a buffet pertenecen al TDD-0002.

### Eventos y asincronía
- No requiere evento de negocio obligatorio para completar el alta.

### Servicios externos / adaptadores
- Proveedor de autenticación detrás de `AuthPort`.
- Mecanismo de email/reset provisto por Auth o adaptador equivalente.

---

## 4. Seguridad y aislamiento

### RBAC
- Registro/login/recuperación son públicos.
- El alta por este flujo solo puede otorgar rol CUSTOMER.

### Tenant scope
- La identidad CUSTOMER es global.
- El `storeCode` no permite autodefinir `organizationId`/`storeId`; se resuelve mediante TDD-0002.

### Datos sensibles y auditoría
- No loguear contraseña, tokens ni secretos.
- No exponer credenciales en respuestas.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- El resultado lógico del alta debe dejar identidad + User + asociación inicial consistentes.

### Concurrencia
- Dos registros concurrentes con el mismo email normalizado no pueden crear dos cuentas.

### Idempotencia
- La unicidad del email evita duplicados en reintentos de registro.
- Solicitudes repetidas de recuperación no crean usuarios ni estado funcional duplicado.

### Reintentos y compensación
- Si se crea una identidad externa y falla la persistencia/asociación, compensar la identidad externa cuando el adaptador lo permita.

---

## 6. Tiempo y dinero

### Tiempo
- No hay reglas funcionales temporales propias salvo las que pueda imponer el mecanismo seguro de recuperación.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- No aplica en este TDD.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Email ya registrado

**Condición:** el email normalizado ya existe  
**Resultado esperado:** rechazar registro  
**Error de dominio / HTTP:** `EMAIL_ALREADY_REGISTERED` / 409  
**Efectos laterales:** no crear identidad, User ni membresía nueva.

### Código inválido

**Condición:** el código no resuelve un buffet válido  
**Resultado esperado:** rechazar registro  
**Error de dominio / HTTP:** `INVALID_STORE_CODE` / 422  
**Efectos laterales:** no dejar cuenta operativa parcial.

### Credenciales inválidas

**Condición:** email/contraseña incorrectos  
**Resultado esperado:** rechazar login  
**Error de dominio / HTTP:** `INVALID_CREDENTIALS` / 401  
**Efectos laterales:** no crear sesión.

### Falla del proveedor Auth

**Condición:** Auth no puede completar la operación  
**Resultado esperado:** error técnico controlado  
**Error de dominio / HTTP:** 503/adapter error  
**Efectos laterales:** no dejar alta parcial silenciosa.

---

## 8. Estrategia de testing

### Tests de dominio
- Normalización case-insensitive de email.
- Invariantes de User CUSTOMER.

### Tests de aplicación
- Registro válido, email duplicado, código inválido, login válido/inválido, recuperación/reset.
- Compensación si falla después de crear identidad externa.

### Tests de integración
- UNIQUE real sobre email normalizado.
- Adapters de User/Auth y contrato de membresía.
- Endpoints de auth.

### Seguridad
- No se puede elegir rol administrativo desde registro.
- No aparecen contraseñas/tokens en persistencia funcional ni respuestas/logs.

### Casos críticos
- Dos altas concurrentes con mismo email.
- Falla entre Auth y asociación inicial.

---

## 9. BLOCKERS y decisiones abiertas

**Decisiones abiertas:** el proveedor concreto de autenticación y la política de contraseña se definirán mediante ADR. No bloquean el diseño por puertos.

`Sin BLOCKERS funcionales conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- Todos los CA están implementados.
- `RN-001` a `RN-004` están cubiertas.
- La asociación inicial se realiza por contrato con TDD-0002.
- Tests relevantes pasan.
- Email case-insensitive está protegido también en persistencia.
- No quedan cuentas operativas parciales ni BLOCKERS funcionales.
