# Guía de contribución — Take&Go

Este documento define el flujo de trabajo Git utilizado por el equipo de Take&Go.

## Ramas principales

El repositorio utiliza dos ramas principales:

- `main`: contiene versiones estables del proyecto.
- `develop`: rama de integración del trabajo del equipo.

No se debe trabajar directamente sobre `main` ni sobre `develop`.

## Ramas de trabajo

Cada tarea debe realizarse en una rama independiente creada desde `develop`.

Convenciones utilizadas:

- `feature/...` para nuevas funcionalidades.
- `fix/...` para correcciones.
- `docs/...` para documentación.

Ejemplos:

```text
feature/CHK1-web-bootstrap
feature/CHK1-api-bootstrap
docs/CHK1-flujo-git
fix/correccion-health-check