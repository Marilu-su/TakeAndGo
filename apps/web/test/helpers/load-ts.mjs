import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const src = fileURLToPath(new URL('../../src/', import.meta.url));
const cache = new Map();

// Ejecuta el código real con Node test, resolviendo aliases de Next y CSS Modules.
export async function loadTs(path) {
  const file = resolve(src, path);
  return import(await moduleUrl(file));
}
async function moduleUrl(file) {
  if (cache.has(file)) return cache.get(file);
  let source = await readFile(file, 'utf8');
  source = source.replace(/import styles from '[^']+\.css';/g,
    'const styles = new Proxy({}, { get: (_target, key) => String(key) });');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  let resolved = output;
  const specifiers = [...output.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of new Set(specifiers)) {
    let url;
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
      const base = specifier.startsWith('@/') ? resolve(src, specifier.slice(2)) : resolve(dirname(file), specifier);
      let child = base;
      if (!extname(base)) {
        try { await readFile(`${base}.ts`); child = `${base}.ts`; }
        catch { child = `${base}.tsx`; }
      }
      url = await moduleUrl(child);
    } else { url = pathToFileURL(require.resolve(specifier)).href; }
    resolved = resolved.replaceAll(`'${specifier}'`, JSON.stringify(url)).replaceAll(`"${specifier}"`, JSON.stringify(url));
  }
  const url = `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`;
  cache.set(file, url);
  return url;
}
