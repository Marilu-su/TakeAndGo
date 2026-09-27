# Diagrama de Arquitectura Cloud — Take&Go

```mermaid
graph TD
    subgraph Client Tier ["Capa de Cliente (PaaS / Edge)"]
        Browser["CUSTOMER / Staff (Next.js App)"]
    end

    subgraph CDN ["Distribución y Seguridad"]
        CloudFlare["CDN / Edge / DNS"]
    end

    subgraph Compute Tier ["Capa de Cómputo (Backend Modular)"]
        API["API Backend (Node.js + TypeScript / Hexagonal Architecture)"]
    end

    subgraph AI Services ["Capa de Inteligencia Artificial"]
        MenIA["MenIA (LLM Gestionado + STT)"]
        CocIA["CocIA (Predictor de Tiempos y Scheduler)"]
    end

    subgraph Data & Persistence Tier ["Capa de Persistencia Gestionada"]
        DB[(PostgreSQL Gestionado + Prisma ORM)]
    end

    subgraph External Services ["Servicios Externos"]
        Pay["Pasarela de Pagos Virtual"]
        Push["Servicio de Notificaciones Push"]
    end

    %% Conexiones principales
    Browser -->|HTTPS / REST| CloudFlare
    CloudFlare -->|Proxy / Request| API
    
    API -->|Validación / Consulta| MenIA
    API -->|Planificación de Cocina| CocIA
    
    API -->|Transacciones ACID (Todo o Nada)| DB
    API -->|Procesamiento de Pagos| Pay
    API -->|Alertas in-app / Push| Push