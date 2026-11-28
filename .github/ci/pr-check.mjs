import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function selectSuites(paths) {
  const suites = { api: false, web: false };

  for (const path of paths) {
    if (path.startsWith('docs/') || (!path.startsWith('.github/') && /\.md$/i.test(path))) {
      continue;
    }
    if (path.startsWith('apps/api/')) {
      suites.api = true;
      // La integración web de MenIA ejecuta código de la API.
      suites.web = true;
    } else if (path === '.github/workflows/api-ci.yml') {
      suites.api = true;
    } else if (
      path.startsWith('apps/web/') ||
      path === '.github/workflows/web-ci.yml' ||
      path === '.github/workflows/deploy-web.yml'
    ) {
      suites.web = true;
    } else {
      // Shared configuration and unknown paths require both suites.
      suites.api = true;
      suites.web = true;
    }
  }

  return suites;
}

export function gateFailures({ changes, apiSelected, apiResult, webSelected, webResult }) {
  if (changes !== 'success') return [`Selección de suites: ${changes || 'sin resultado'}`];

  const failures = [];
  for (const [suite, selected, result] of [
    ['API', apiSelected, apiResult],
    ['Web', webSelected, webResult],
  ]) {
    if (selected !== 'true' && selected !== 'false') {
      failures.push(`${suite}: selección inválida`);
      continue;
    }

    const expected = selected === 'true' ? 'success' : 'skipped';
    if (result !== expected) {
      failures.push(`${suite}: se esperaba ${expected}, resultado ${result || 'ausente'}`);
    }
  }

  return failures;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const command = process.argv[2];

  if (command === 'select') {
    // On pull_request, HEAD is the merge result and its first parent is the base.
    const paths = execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', 'HEAD^1', 'HEAD', '--'],
      { encoding: 'utf8' },
    ).split('\0').filter(Boolean);
    const { api, web } = selectSuites(paths);
    appendFileSync(process.env.GITHUB_OUTPUT, `api=${api}\nweb=${web}\n`);
    console.log(`Suites seleccionadas: API=${api}, Web=${web}`);
  } else if (command === 'gate') {
    const failures = gateFailures({
      changes: process.env.CHANGES_RESULT,
      apiSelected: process.env.API_SELECTED,
      apiResult: process.env.API_RESULT,
      webSelected: process.env.WEB_SELECTED,
      webResult: process.env.WEB_RESULT,
    });

    if (failures.length) {
      console.error(failures.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`Suites aplicables verificadas. API=${process.env.API_RESULT}, Web=${process.env.WEB_RESULT}`);
    }
  } else {
    throw new Error('Usar select o gate.');
  }
}
