# Take&Go — Índice de TDDs V1

> Basado en `TAKEANDGO_MASTER_V3`. Los TDD no incluyen plan de implementación; ese documento se mantiene separado para controlar qué trabajo se entrega a Codex.

| TDD | Nombre | Dependencias principales | Track sugerido | Dificultad relativa |
|---|---|---|---|---:|
| TDD-0001 | Autenticación y Cuenta Global CUSTOMER | 0002 (contrato asociación) | A | 2 |
| TDD-0002 | Asociación a Buffets, Perfil y Preferencias | 0001, 0003 | A | 3 |
| TDD-0003 | Organización, Buffets, Horarios y Staff | 0001 | B | 4 |
| TDD-0004 | Catálogo, Categorías, Productos y Adicionales | 0003 | B | 3 |
| TDD-0005 | Inventario, Reservas y Movimientos | 0003, 0004 | C | 6 |
| TDD-0006 | MenIA | 0002, 0004, contratos 0005/0007/0008/0013/0014 | A | 6 |
| TDD-0007 | Pedidos, Ventanas, Pago y Reembolso | 0002, 0003, 0004, 0005, contrato 0008 | C | 6 |
| TDD-0008 | CocIA | 0003, 0004, contratos 0007/0009 | D | 5 |
| TDD-0009 | Cocina y Venta Presencial | 0004, 0005, 0007, 0008 | D | 3 |
| TDD-0010 | Retiro, QR y Fallback Manual | 0005, 0007, 0009 | D | 2 |
| TDD-0011 | No Retiro, Recuperación y Sanciones | 0003, 0005, 0007, 0010 | D | 4 |
| TDD-0012 | Notificaciones | eventos 0007/0008/0010/0011 | C | 2 |
| TDD-0013 | Puntos y Fidelización | 0003, 0007, 0010 | A | 3 |
| TDD-0014 | Recompensas, Canjes y Beneficio 10% | 0003, 0004, 0005, 0007, 0008, 0010, 0011, 0013 | B | 7 |

## División sugerida

- **Track A — Customer, MenIA y Puntos (14):** 0001, 0002, 0006, 0013.
- **Track B — Gobierno, Catálogo y Recompensas (14):** 0003, 0004, 0014.
- **Track C — Núcleo Transaccional (14):** 0005, 0007, 0012.
- **Track D — CocIA, Cocina y Retiro (14):** 0008, 0009, 0010, 0011.

## Regla de trabajo

Los contratos entre módulos deben acordarse antes de abrir features que dependan de ellos. El plan de implementación, orden fino de tareas y prompts para Codex se mantiene en un documento separado.
