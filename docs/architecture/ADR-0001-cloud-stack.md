# ADR-0001: Selección del Stack Tecnológico y Persistencia Cloud

## Estado
Aprobado

## Contexto
Take&Go requiere una arquitectura robusta, escalable y orientada a microservicios modulares (o API modular bajo arquitectura hexagonal) para soportar la alta concurrencia en buffets universitarios/corporativos, garantizando consistencia transaccional estricta en la gestión de stock, pagos y puntos de fidelización.

## Decisión
Se adopta el siguiente stack tecnológico base:
- **Backend:** Node.js con TypeScript estructurado mediante Arquitectura Hexagonal (Ports & Adapters).
- **Base de Datos:** PostgreSQL gestionado (SQL Cloud).
- **ORM:** Prisma para el Domain Modeling, control de migraciones y seguridad tipada.

## Consecuencias y Trade-offs
- **Positivas:** Tipado estricto extremo de punta a punta, migraciones versionadas predecibles, transaccionalidad robusta para prevenir sobreventas de stock (regla de todo o nada).
- **Negativas / Mitigaciones:** Dependencia de un ORM monolítico que se mitiga desacoplando la lógica de dominio pura mediante puertos e interfaces en la capa de aplicación.
## Componentes Cloud y Despliegue
- **Hosting del Backend / API:** Contenedores o servicio PaaS escalable (ej. Render, Fly.io o AWS ECS/Lambda) para aislar la lógica de negocio y garantizar la ejecución del backend como autoridad funcional.
- **Hosting del Frontend:** Despliegue optimizado en plataforma PaaS (ej. Vercel o AWS Amplify) para Next.js.
- **Autenticación:** Gestión de sesiones y credenciales basada en tokens seguros (JWT / Auth gestionado) acoplado al modelo de membresías (`CustomerStoreMembership`).
- **Inteligencia Artificial (MenIA / CocIA):** Integración con proveedores de LLM gestionados para el procesamiento de lenguaje natural y el motor predictivo de tiempos de cocina.

## Decisiones Relacionadas
- Supeditado al cumplimiento estricto de las Reglas de Negocio V2.0 (transacciones de todo o nada para stock y puntos)