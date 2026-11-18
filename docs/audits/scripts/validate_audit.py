"""Valida exclusivamente las 184 RN y su sincronización. No audita pantallas ni producto."""
import json
from build_matrices import check_matrix


def main():
    counts = check_matrix()
    print(json.dumps({'result': 'PASS', 'rules': sum(counts.values()), 'states': dict(counts), 'scope': 'RN only'}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
