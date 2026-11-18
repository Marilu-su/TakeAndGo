---
version: V1
estado: BORRADOR
responsable: "[Integrante]"
fecha: "2026-09-23"
---

# TDD-0004 — Catálogo, Categorías, Productos y Adicionales

## 1. Contexto de negocio

### Objetivo
Implementar el catálogo por buffet, con categorías, productos, precios, adicionales, tiempos base de preparación y activación/desactivación conservando trazabilidad histórica.

### Roles involucrados
- `STORE_ADMIN`
- `CUSTOMER` como consumidor de lectura a través de MenIA

### Reglas de negocio relacionadas
`RN-029` a `RN-034`; relacionadas: `RN-031`, `RN-033`, `RN-040` a `RN-042`, `RN-096`, `RN-097`.

### Alcance
- CRUD/desactivación de categorías.
- CRUD/desactivación de productos.
- Precio base por producto.
- Adicionales y precios propios.
- Tiempo base de preparación por producto y extra de preparación por adicional.
- Consulta de catálogo del buffet mediante contrato.

### Dependencias
- `TDD-0003` para Store y permisos.
- `TDD-0005` provee disponibilidad/stock; este TDD no la decide.

---

## 2. Criterios de aceptación

### CA-01 — Producto en una categoría

**Dado** un STORE_ADMIN y una categoría de su buffet  
**Cuando** crea un producto  
**Entonces** el producto queda asociado a una única categoría del mismo buffet

**RN relacionadas:** `RN-029`

### CA-02 — Administrar categorías

**Dado** un STORE_ADMIN  
**Cuando** crea, edita o desactiva una categoría  
**Entonces** solo afecta su buffet y no rompe historial existente

**RN relacionadas:** `RN-030`

### CA-03 — Precio y adicionales

**Dado** un producto  
**Cuando** se configuran precio base y adicionales  
**Entonces** cada precio queda definido por el STORE_ADMIN del buffet

**RN relacionadas:** `RN-031`, `RN-032`

### CA-04 — Tiempo base

**Dado** un producto del buffet  
**Cuando** el STORE_ADMIN configura su tiempo base  
**Entonces** el valor queda disponible para CocIA

**RN relacionadas:** `RN-033`, `RN-096`

### CA-05 — Desactivación sin borrado histórico

**Dado** un producto referenciado por pedidos previos  
**Cuando** se desactiva  
**Entonces** deja de ofrecerse para nuevas operaciones sin eliminar referencias históricas

**RN relacionadas:** `RN-034`

---

## 3. Diseño técnico

### Modelo de dominio
- `Category`
- `Product`
- `Addition`
- `ProductAddition`

**Invariantes principales**
- Product pertenece a una sola Category y a un solo Store por esa categoría.
- Precios no negativos.
- Desactivar no equivale a borrar.
- Un adicional asociado debe pertenecer al mismo buffet/contexto del producto.

### Casos de uso
- `CreateCategory`
- `UpdateCategory`
- `DeactivateCategory`
- `CreateProduct`
- `UpdateProduct`
- `DeactivateProduct`
- `CreateAddition`
- `ConfigureProductAdditions`
- `GetStoreCatalog`

### Puertos requeridos
- `CategoryRepositoryPort`
- `ProductRepositoryPort`
- `AdditionRepositoryPort`
- `StoreScopePort`
- `InventoryAvailabilityPort`

### Contratos / API
- `/api/v1/stores/:storeId/categories CRUD`
- `/api/v1/stores/:storeId/products CRUD`
- `/api/v1/stores/:storeId/additions CRUD`
- `GET /api/v1/stores/:storeId/catalog`

### Persistencia
- Category/Product/Addition con store scope.
- ProductAddition como relación explícita.
- Mantener nombres/precios históricos en Order snapshots, no depender de catálogo mutable.

### Eventos y asincronía
- `CatalogChanged` opcional para invalidación de cache/consumidores.

### Servicios externos / adaptadores
- No requiere proveedor externo.

---

## 4. Seguridad y aislamiento

### RBAC
- Solo STORE_ADMIN del buffet modifica catálogo.
- CUSTOMER no modifica; lectura pública/autenticada se sirve por casos de uso.

### Tenant scope
- Toda entidad de catálogo queda scoped al Store.
- No asociar categorías/adicionales cross-store.

### Datos sensibles y auditoría
- Registrar cambios administrativos relevantes de precio/estado cuando el diseño de auditoría común lo contemple.

---

## 5. Consistencia, concurrencia e idempotencia

### Transacciones
- Configurar asociaciones Product-Addition debe ser consistente y evitar relaciones parciales inválidas.

### Concurrencia
- Ediciones concurrentes deben evitar lost updates según estrategia del repositorio.

### Idempotencia
- Operaciones de creación con retry no deben duplicar si se adopta idempotency key en API; no es requisito funcional obligatorio.

### Reintentos y compensación
- Lecturas son reintentables; escrituras respetan constraints.

---

## 6. Tiempo y dinero

### Tiempo
- No hay vencimientos funcionales; timestamps de catálogo son auditables.

- Toda lógica temporal propia del dominio debe usar `Clock` inyectable.
- La timezone funcional es la del buffet/organización, nunca la del navegador.

### Dinero
- Precio base y precio de adicional con tipo monetario seguro.

- Cuando existan importes, no usar `float` binario; usar Decimal o unidades menores según el ADR de persistencia/dinero.

---

## 7. Casos de borde y manejo de errores

### Categoría de otro buffet

**Condición:** se intenta asociar Product a Category cross-store  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** `INVALID_CATEGORY_SCOPE` / 422  
**Efectos laterales:** ninguno.

### Producto desactivado

**Condición:** se consulta catálogo operativo  
**Resultado esperado:** no ofrecerlo como nueva opción  
**Error de dominio / HTTP:** No aplica  
**Efectos laterales:** historial previo intacto.

### Precio inválido

**Condición:** precio negativo o formato monetario inválido  
**Resultado esperado:** rechazar  
**Error de dominio / HTTP:** 422  
**Efectos laterales:** conservar valor anterior.

---

## 8. Estrategia de testing

### Tests de dominio
- Producto-categoría, precio, estados activo/inactivo.
- Relaciones ProductAddition.

### Tests de aplicación
- CRUD autorizado y catálogo.
- Desactivación conserva referencias.

### Tests de integración
- FK/constraints cross-store.
- Persistencia monetaria sin float.

### Seguridad
- STORE_ADMIN de otro buffet no modifica catálogo.

### Casos críticos
- Actualización de precio mientras existe un pedido: el pedido conserva snapshot.
- Catálogo consume disponibilidad sin acoplarse a tablas de Inventory.

---

## 9. BLOCKERS y decisiones abiertas

`Sin BLOCKERS conocidos.`

---

## 10. Definition of Done

El TDD se considera completo cuando:

- CA implementados.
- Reglas de catálogo cubiertas.
- Tenant/RBAC verificados.
- Snapshots históricos no dependen de cambios posteriores.
- Tests pasan.
- No quedan BLOCKERS.
