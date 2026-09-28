# Diagrama de Arquitectura Cloud — Take&Go

```mermaid
graph TD
    subgraph Client ["Capa de Cliente (PaaS / Edge)"]
        Browser["CUSTOMER / Staff (Next.js App)"]
    end

    subgraph CDN ["Distribución y Seguridad"]
        CloudFlare["CDN / Edge / DNS"]
    end

    subgraph Compute ["Capa de Cómputo (Backend Modular)"]
        API["API Backend (Node.js + TypeScript / Hexagonal Architecture)"]
    end

    subgraph AI ["Capa de Inteligencia Artificial"]
        MenIA["MenIA (LLM Gestionado + STT)"]
        CocIA["CocIA (Predictor de Tiempos y Scheduler)"]
    end

    subgraph Persistence ["Capa de Persistencia Gestionada"]
        DB[(PostgreSQL Gestionado + Prisma ORM)]
    end

    subgraph External ["Servicios Externos"]
        Pay["Pasarela de Pagos Virtual"]
        Push["Servicio de Notificaciones Push"]
    end

    Browser -->|HTTPS / REST| CloudFlare
    CloudFlare -->|Proxy / Request| API
    
    API -->|Validacion / Consulta| MenIA
    API -->|Planificacion de Cocina| CocIA
    
    API -->|Transacciones ACID Atomicas| DB
    API -->|Procesamiento de Pagos| Pay
    API -->|Alertas in-app / Push| Push