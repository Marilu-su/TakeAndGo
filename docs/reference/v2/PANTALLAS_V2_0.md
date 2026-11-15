# Take&Go — Mapa de Pantallas V2.0

> Especificación funcional para maquetado. La UI no decide reglas: renderiza/solicita decisiones al backend.

## CUSTOMER

### 1. Login
- Email
- Contraseña
- Ingresar
- Olvidé mi contraseña
- Crear cuenta

### 2. Registro
- Nombre
- Email
- Contraseña
- Código buffet `AAA999`

### 3. Home global
- Buffets asociados (nombre + organización)
- Entrar
- Asociar otro buffet
- Perfil
- Preferencias
- Historial
- Salir

### 4. Perfil / Preferencias
Secciones:
- Datos personales
- Preferencias de productos
- Exclusiones de productos/ingredientes
- Restricciones de dieta: Sin TACC / Vegetariano / Vegano
- Rutina semanal

### 5. Historial global
Filtros:
- fecha
- organización
- buffet
- estado

Mostrar:
- pedido/canje
- buffet/organización
- fecha
- total
- estado
- puntos ganados/gastados/reintegrados

### 6. MenIA — contexto buffet
Header claro:
- Buffet activo
- Organización
- Cambiar buffet

Chat:
- texto
- audio
- cards estructuradas

### 7. Catálogo dentro de MenIA
- agrupado por categorías
- solo disponibles
- precio base
- selección -> adicionales disponibles + precios

### 8. Recomendaciones
Hasta 4 cards válidas:
- producto
- precio
- horario/ventana factible
- seleccionar

### 9. Pedido programado
Selector:
- fecha dentro del máximo permitido por organización
- horario/ventana ofrecida por backend

Mostrar claramente:
- fecha
- buffet
- ventana
- tolerancia

### 10. Confirmación de pedido
- productos
- adicionales
- cantidad
- total
- fecha
- ventana
- Confirmar
- Modificar
- Cancelar

### 11. Pago
- estado RESERVADO
- contador máximo 5:00
- total
- acceso a pasarela
- mensaje de pago aprobado/rechazado/reembolsado

### 12. Seguimiento
Stepper:
- Confirmado
- En preparación
- Para retirar
- Retirado

### 13. Avisar que no podré retirar
Disponible antes del inicio de la ventana.

Confirmación explícita:
> “No recibirás un strike si avisás antes de que comience tu ventana, pero el pedido no tendrá reembolso.”

Botones:
- Confirmar aviso
- Volver

### 14. Retraso CocIA
Banner/card:
- nueva ventana
- nueva tolerancia
- mensaje de actualización

### 15. Para retirar
- QR
- código corto
- ventana/tolerancia
- resumen de operación

### 16. Puntos en MenIA
Usuario:
> “¿Cuántos puntos tengo?”

MenIA:
> “Tenés XXX puntos en Organización X. ¿Querés canjearlos?”

Botones:
- Sí
- No

### 17. Recompensas elegibles
Solo mostrar:
- costo <= saldo
- reward ofrecida por buffet
- físicas con stock elegible
- 10% solo si no existe otro activo

Costos readonly:
- Café 250
- Snack 300
- Panadería 350
- Bebida fría 350
- 10% 500

### 18. Canje físico
- elegir tipo
- elegir uno de hasta 2 productos disponibles
- elegir fecha/horario válido
- confirmar puntos a gastar

### 19. Canje físico activo
- producto
- fecha/ventana
- estado
- QR cuando corresponda
- leyenda: “Los canjes no generan puntos”

### 20. Café canjeado
Al validar llegada:
> “Llegada registrada. Estamos preparando tu café.”

### 21. Beneficio 10%
Visualización:
- Activo
- Vence DD/MM/YYYY
- Un solo uso

Durante pedido:
> “Tenés un beneficio de 10% disponible. ¿Querés usarlo?”

Botones:
- Aplicar 10%
- Guardarlo para otra compra

### 22. Organización bloqueada
Modo solo visualización:
- historial visible
- puntos visibles
- recompensas visibles
- beneficios visibles
- acciones transaccionales deshabilitadas

---

## STORE_EMPLOYEE

### 23. Cola CocIA
- orden/prioridad
- pedido/canje/venta presencial
- fecha/hora prometida
- estimated time
- recommendedStartAt
- estado
- Iniciar preparación
- Finalizar

### 24. Venta presencial
- catálogo
- adicionales
- cantidad
- total
- registrar

### 25. Escaneo QR
- cámara/lector
- resultado de validación
- operación a entregar

### 26. Retiro manual
- código corto
- resumen
- confirmar retiro manual

### 27. Retiro combinado
Si pedido normal + canje físico comparten ventana:
- una card de “Retiro combinado”
- ambas operaciones visibles
- validación coordinada
- backend las conserva separadas

---

## STORE_ADMIN

### 28. Dashboard buffet
- pedidos
- ventas
- carga
- no retiros
- desperdicio

### 29. Configuración inicial
Formulario/plantilla:
- datos buffet
- horarios por día
- cierre de pedidos digitales
- cierre operativo
- parámetros CocIA

### 30. Categorías
CRUD.

### 31. Productos
- categoría
- nombre
- descripción
- precio
- tiempo base
- activo

### 32. Adicionales
- nombre
- precio
- extra preparación
- stock si corresponde

### 33. Stock
- disponible
- reservado
- restock
- ajuste + motivo
- movimientos

### 34. Empleados
- listar
- crear/asignar
- desactivar

### 35. Recompensas del buffet
Tipos fijos y costos readonly.

Para cada física:
- ofrecer sí/no
- producto elegible 1
- producto elegible 2

Para 10%:
- ofrecer sí/no

---

## ORGANIZATION_ADMIN

### 36. Dashboard organización
- buffets
- ventas consolidadas
- pedidos
- no retiros
- desperdicio
- sanciones

### 37. Buffets
- crear/dar de baja
- asignar/reemplazar STORE_ADMIN

### 38. Configuración organización
- máximo de días de anticipación para pedidos
- default inicial: 7 días

### 39. Sanciones
- CUSTOMER
- strikes
- warnings
- status
- rehabilitar cuando corresponde

---

## Estados visuales obligatorios

- loading
- empty
- error
- sin stock
- sin horario disponible
- pago pendiente (5 min)
- pago rechazado
- pago reembolsado
- MenIA durmiendo
- CocIA fallback
- usuario bloqueado/solo visualización
- beneficio vencido
- recompensa no disponible

## Responsive
- CUSTOMER: mobile-first.
- Cocina/admin: priorizar tablet/desktop sin romper mobile.
