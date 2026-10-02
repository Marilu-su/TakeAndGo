# Guía de contribución — Take&Go

Este documento define el flujo de trabajo Git utilizado por el equipo de Take&Go.

## Ramas principales

El repositorio utiliza dos ramas principales:

- `main`: contiene versiones estables del proyecto.
- `develop`: rama de integración del trabajo del equipo.

No se debe trabajar directamente sobre `main` ni sobre `develop`.

## Ramas de trabajo

Cada tarea debe realizarse en una rama independiente creada desde `develop`.

Antes de crear una rama de trabajo, se debe actualizar `develop`:

```bash
git switch develop
git pull origin develop
```

Luego se crea la rama correspondiente a la tarea.

Convenciones utilizadas:

- `feature/...` para nuevas funcionalidades.
- `fix/...` para correcciones.
- `docs/...` para documentación.
- `chore/...` para tareas de configuración o mantenimiento.

Ejemplos:

```text
feature/C2-01-project-setup
feature/C2-03-customer
docs/actualizar-readme
fix/correccion-health-check
```

## Flujo de una tarea

Las tareas del proyecto se gestionan mediante GitHub Projects e Issues.

El flujo esperado es:

```text
Issue en Backlog
      │
      ▼
Issue en In Progress
      │
      ▼
Rama de trabajo
      │
      ▼
Commits
      │
      ▼
Pull Request hacia develop
      │
      ▼
Revisión de otro integrante
      │
      ▼
Merge
      │
      ▼
Issue cerrada
      │
      ▼
Done
```

Al comenzar una tarea, su estado en GitHub Projects debe cambiarse a `In Progress`.

No se debe cerrar manualmente la Issue mientras la Pull Request asociada permanezca abierta.

## Commits

Los commits deben seguir la convención Conventional Commits.

Tipos utilizados habitualmente:

```text
feat: nueva funcionalidad
fix: corrección de un error
docs: cambios de documentación
test: incorporación o modificación de pruebas
chore: configuración o mantenimiento
```

Las descripciones de los commits se escriben en español.

Ejemplos:

```text
feat: agregar asociación de cliente con buffet
fix: corregir validación del código de buffet
docs: documentar entorno de desarrollo local
test: agregar pruebas de integración de customer
chore: configurar entorno inicial del proyecto
```

Cada commit debe representar un cambio coherente y relacionado con la tarea en desarrollo.

## Pull Requests

Los cambios deben incorporarse a `develop` mediante Pull Request.

No se deben integrar cambios directamente a `develop` ni a `main`.

Toda Pull Request debe:

- tener como destino la rama correspondiente, normalmente `develop`;
- describir brevemente el trabajo realizado;
- indicar los cambios principales;
- indicar las validaciones o pruebas realizadas;
- estar vinculada con la Issue correspondiente;
- ser revisada por otro integrante del equipo.

El autor de una Pull Request no puede aprobar su propia PR como revisión válida.

## Vinculación entre Pull Requests e Issues

Toda Pull Request debe estar vinculada con la Issue correspondiente del GitHub Project.

Para ello, la descripción de la Pull Request debe incluir:

```text
Closes #<número-de-issue>
```

Por ejemplo:

```text
Closes #39
```

De esta manera, GitHub vincula la Pull Request con la Issue y puede cerrar automáticamente la Issue cuando los cambios son integrados.

La Issue debe permanecer abierta mientras la Pull Request esté pendiente de revisión o integración.

## Descripción recomendada para una Pull Request

Se recomienda utilizar la siguiente estructura:

```text
## Descripción

Breve explicación de la tarea realizada.

### Cambios realizados

- Cambio 1.
- Cambio 2.

### Validaciones realizadas

- Validación 1.
- Validación 2.

### Issue relacionada

Closes #<número-de-issue>
```

## Revisión y merge

Antes de realizar el merge se debe verificar que:

- la Pull Request corresponde a la tarea indicada;
- los cambios fueron revisados por otro integrante;
- las validaciones necesarias fueron realizadas;
- no existen cambios ajenos a la tarea;
- la rama de destino es la correcta.

Una vez aprobada la Pull Request, los cambios pueden integrarse a `develop`.

Al completarse el merge, la Issue vinculada mediante `Closes #...` debe quedar cerrada y la tarea debe reflejarse como `Done` en GitHub Projects.