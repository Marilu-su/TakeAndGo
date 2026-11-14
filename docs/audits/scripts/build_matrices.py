"""Genera solo la matriz RN. --check no escribe; --update-hashes solo actualiza hashes."""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
AUDIT = ROOT / 'docs/audits'
MASTER = ROOT / 'docs/reference/v2/TAKEANDGO_MASTER_V2_0.md'
PLAN = ROOT / 'docs/reference/planning/TAKEANDGO_PLAN_VERIFICADO_REPO_2026-11-12.md'
DATA = AUDIT / 'data/rn-cumplimiento.json'
MATRIX = AUDIT / 'T04-MATRIZ-CUMPLIMIENTO.md'
STATES = {'PROBADO', 'PARCIAL', 'NO_LOCALIZADO', 'PENDIENTE_INTEGRACION', 'PENDIENTE_VALIDACION', 'BLOCKER'}
HEADER = '# T04 — Matriz de cumplimiento RN-001–RN-184\n\nFecha: 12/11/2026. Base integrada: `54b84064dc393477ec197c202a5ebd8a48b56aa8`. Fuente: [Master V2.0](../reference/v2/TAKEANDGO_MASTER_V2_0.md).\n\nLas descripciones conservan el texto de cada RN. La clasificación es una evaluación técnica asistida pendiente de revisión humana, basada en código, pruebas locales e historial CI; no se calcula por existencia de archivos. Los paths de evidencia son relativos a la raíz salvo archivo consecutivo dentro del mismo módulo. Los informes de backend, frontend y testing pertenecen a otras unidades de T04; esta matriz conserva sus límites de evidencia en cada fila. Las pruebas HTTP con puertos de prueba no acreditan proveedor externo o PostgreSQL.\n\n`PROBADO` se limita a la regla y al circuito indicado; no declara completo su módulo. `PENDIENTE_INTEGRACION` no significa que la rama cumpla toda la RN. No se asignan porcentajes.\n\n## Revisión documental de las reglas — 13/11/2026\n\nSe corrigieron RN-026 (PROBADO -> PENDIENTE_VALIDACION) y RN-112 (PROBADO -> PARCIAL), con motivo en sus filas; no se cambió ninguna otra clasificación. Las 108 brechas genéricas se sustituyeron por conductas específicas y lugares de búsqueda. Las búsquedas describen ausencia localizada, no prueba exhaustiva de inexistencia ni ejecución nueva de pruebas.\n\nReferencias de trabajo pendiente verificadas por objetos Git locales, sin cambiar de rama: MenIA `feature/C3-01-menia@fae7add08f318e6a554947067328bdf3049bb1b4`; PR #89 según snapshot, `feature/C2-frontend-rutas-base@7831234b2875c67c01daf81508b52e76e0e60b9b`. Los archivos se consultan en esos commits; no se presupone que estén integrados ni que los heads remotos actuales sigan iguales.\n\nLas evaluaciones se mantienen en `data/rn-cumplimiento.json`; los textos funcionales se leen del Master sin modificarlos. `python -B docs/audits/scripts/build_matrices.py` genera esta matriz y `--check` comprueba sincronización sin escribir. La actualización del manifiesto de fuentes es una operación separada y explícita con `--update-hashes`. Revisión humana pendiente; el documento no certifica cumplimiento de las reglas pendientes.\n\n'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_inputs():
    rules = re.findall(r'^\*\*(RN-\d{3})\.\*\*\s+(.+)$', MASTER.read_text(encoding='utf-8-sig'), re.M)
    expected = [f'RN-{n:03}' for n in range(1, 185)]
    require([rid for rid, _ in rules] == expected, 'Master: IDs faltantes, duplicados o desordenados')
    records = json.loads(DATA.read_text(encoding='utf-8'))
    require(isinstance(records, list) and len(records) == 184, 'JSON: deben existir 184 registros')
    require(all(isinstance(r, dict) for r in records), 'JSON: cada registro debe ser un objeto')
    require([r.get('id') for r in records] == expected, 'JSON: IDs faltantes, duplicados o desordenados')
    tasks = set(re.findall(r'\*\*\[(T\d{2})\]', PLAN.read_text(encoding='utf-8-sig')))
    require(bool(tasks), 'No se localizaron tareas en la planificación')
    for record in records:
        rid = record['id']
        for field in ('modulo', 'estado', 'evidencia', 'brecha'):
            value = record.get(field)
            require(isinstance(value, str) and bool(value.strip()), f'{rid}: campo obligatorio inválido: {field}')
            require('\n' not in value and '\r' not in value and '|' not in value, f'{rid}: separador Markdown no permitido en {field}')
        require(record['estado'] in STATES, f'{rid}: estado inválido')
        related = record.get('tareas')
        require(isinstance(related, list) and bool(related), f'{rid}: tareas obligatorias')
        require(all(isinstance(t, str) and t in tasks for t in related), f'{rid}: tarea inexistente en planificación')
        require(len(related) == len(set(related)), f'{rid}: tareas duplicadas')
    return rules, records


def render_matrix():
    rules, records = load_inputs()
    counts = collections.Counter(r['estado'] for r in records)
    text = HEADER + '## Conteo reproducible\n\n'
    text += '\n'.join(f'- `{state}`: {count}.' for state, count in sorted(counts.items()))
    text += '\n\n## Reglas\n\n| ID | Descripción del Master | Módulo | Estado | Evidencia concreta | Brecha / siguiente verificación | Tarea |\n|---|---|---|---|---|---|---|\n'
    for (rid, description), record in zip(rules, records):
        fields = [rid, description.replace('|', '\\|'), record['modulo'], record['estado'], record['evidencia'], record['brecha'], ','.join(record['tareas'])]
        text += '| ' + ' | '.join(fields) + ' |\n'
    return text, counts


def check_matrix():
    generated, counts = render_matrix()
    require(MATRIX.is_file(), 'Falta la matriz; ejecutar el generador')
    require(MATRIX.read_bytes() == generated.encode('utf-8'), 'Matriz desincronizada: ejecutar build_matrices.py sin --check')
    return counts


def update_source_hashes():
    # Operación independiente: nunca regenera la matriz ni modifica las fuentes.
    sources = ROOT / 'docs/reference'
    manifest = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(sources.rglob('*'))
                if p.is_file() and p.suffix in {'.md', '.pdf'} and p.name != 'README.md'}
    destination = AUDIT / 'evidence/source-sha256.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    print(json.dumps({'operation': 'update-hashes', 'sources': len(manifest)}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--update-hashes', action='store_true')
    args = parser.parse_args()
    if args.update_hashes:
        update_source_hashes()
        return
    if args.check:
        counts = check_matrix()
    else:
        generated, counts = render_matrix()
        MATRIX.write_bytes(generated.encode('utf-8'))
    print(json.dumps({'result': 'PASS', 'operation': 'check' if args.check else 'generate', 'rules': sum(counts.values()), 'states': dict(counts)}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
