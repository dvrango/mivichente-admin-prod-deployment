#!/usr/bin/env node
// Corre places-scraper.mjs en batch pa toda la semilla inicial, leyendo un manifest.
// Resuelve el category_id por NOMBRE (o alias) desde la DB — no pegas UUIDs a mano.
//
// Uso:
//   node --env-file=.env.local scripts/scrape-seed.mjs                       # dry-run: guarda JSONs + fotos, no inserta
//   node --env-file=.env.local scripts/scrape-seed.mjs --from-output --push  # inserta los JSONs del dry-run (sin re-scrapear)
//   node --env-file=.env.local scripts/scrape-seed.mjs --push                # scrapea E inserta directo (re-scrapea, 1 paso)
//   node --env-file=.env.local scripts/scrape-seed.mjs --manifest scripts/otro.json --push
//
// Flujo recomendado (2 pasos, revisas antes de insertar):
//   1. dry-run                → scripts/output/<query>__<lugar>.json (+ fotos)
//   2. revisas/editas los JSON
//   3. --from-output --push   → inserta esos JSON tal cual, sin gastar API de nuevo
//
// Env requerido (los mismos que places-scraper.mjs):
//   GOOGLE_PLACES_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Manifest (default scripts/seed-manifest.json):
//   {
//     "locations": ["Villa Unión, Durango", "Nombre de Dios, Durango"],
//     "jobs": [
//       { "category": "Taqueria" },                          // usa el nombre como query
//       { "category": "Comida Mexicana", "queries": ["Restaurante", "Fonda"] }  // queries custom
//     ]
//   }
//
// El municipio pa cada negocio se deriva del texto de location (parte antes de la coma).
//
// Flags extra:
//   --limit N        tope de negocios por corrida (pruebas)
//   --created-by ID  profile id del admin pa created_by/updated_by (sin él quedan "desconocido")

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRAPER = path.join(SCRIPT_DIR, 'places-scraper.mjs');

const args = parseArgs(process.argv.slice(2));
const push = Boolean(args.push);
const fromOutput = Boolean(args['from-output']);
const manifestPath = args.manifest ?? path.join(SCRIPT_DIR, 'seed-manifest.json');
const outDir = args.out ?? path.join(SCRIPT_DIR, 'output');
const limit = args.limit ? Number(args.limit) : null; // tope de negocios por corrida (test)
const createdBy = args['created-by'] ?? null; // profile id del admin (created_by/updated_by)

if (fromOutput && !push) {
  console.error('--from-output requiere --push (inserta los JSONs ya scrapeados).');
  process.exit(1);
}

// Nombre único por query+ubicación. Debe coincidir con lo que el dry-run guardó
// (dry-run pasa este mismo path como --out-file al scraper).
function outFileFor(query, location) {
  const slug = (s) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  return path.join(outDir, `${slug(query)}__${slug(location)}.json`);
}

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    console.error(`Falta ${key} en env. Corre con: node --env-file=.env.local scripts/scrape-seed.mjs`);
    process.exit(1);
  }
}

function normalize(str) {
  return (str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .trim();
}

function municipioFromLocation(location) {
  return location.split(',')[0].trim();
}

async function loadCategoryMap() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await supabase.from('categories').select('id, name, aliases');
  if (error) throw new Error(`No pude leer categories: ${error.message}`);

  const byName = new Map();
  for (const cat of data) {
    byName.set(normalize(cat.name), cat);
    for (const alias of cat.aliases ?? []) byName.set(normalize(alias), cat);
  }
  return { byName, all: data };
}

function resolveCategory(name, categoryMap) {
  const cat = categoryMap.byName.get(normalize(name));
  if (!cat) {
    const options = categoryMap.all.map((c) => `  - ${c.name}`).join('\n');
    throw new Error(`Categoría "${name}" no existe en DB. Disponibles:\n${options}`);
  }
  return cat;
}

function runScraper({ query, location, categoryId, municipio }) {
  return new Promise((resolve, reject) => {
    const outFile = outFileFor(query, location);
    const scraperArgs = fromOutput
      ? [
          // Inserta desde el JSON del dry-run, sin re-scrapear (reusa fotos locales).
          SCRAPER,
          '--from-file', outFile,
          '--category-id', categoryId,
          '--push',
        ]
      : [
          SCRAPER,
          '--query', query,
          '--location', location,
          '--category-id', categoryId,
          '--municipio', municipio,
          ...(push ? ['--push'] : ['--out-file', outFile]),
        ];
    if (limit && push) scraperArgs.push('--limit', String(limit));
    if (createdBy && push) scraperArgs.push('--created-by', createdBy);

    const child = spawn(process.execPath, scraperArgs, {
      stdio: 'inherit',
      env: process.env, // hereda las env cargadas por --env-file
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`places-scraper.mjs salió con código ${code}`));
    });
  });
}

// Cuenta cuántos negocios hay en los JSONs del dry-run (solo modo --from-output).
async function countFromOutput(resolved, locations) {
  let total = 0;
  for (const job of resolved) {
    for (const location of locations) {
      for (const query of job.queries) {
        const file = outFileFor(query, location);
        if (!existsSync(file)) continue;
        try {
          const raw = JSON.parse(await readFile(file, 'utf-8'));
          total += raw.businesses?.length ?? 0;
        } catch {
          // JSON corrupto → lo ignora en el conteo, el scraper lo reportará.
        }
      }
    }
  }
  return total;
}

// Guarda antes de escribir en la DB: muestra a qué Supabase va y pide confirmación.
async function confirmPush(resolved, locations) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  console.log('──────────────────────────────────────────');
  console.log(`⚠  VAS A INSERTAR en: ${host}`);
  if (fromOutput) {
    const n = await countFromOutput(resolved, locations);
    const capped = limit ? ` (tope --limit ${limit} por corrida)` : '';
    console.log(`   Negocios en los JSONs: ${n}${capped} (dedup por teléfono puede reducir).`);
  } else {
    const cap = limit ? `hasta ${limit} por corrida` : 'todos los resultados';
    console.log(`   Se scrapeará en vivo e insertará ${cap}.`);
  }
  console.log('──────────────────────────────────────────');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Escribe 'si' para continuar: ")).trim().toLowerCase();
  rl.close();
  if (answer !== 'si') {
    console.log('Cancelado. Nada se insertó.');
    process.exit(0);
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const { locations, jobs } = manifest;
  if (!Array.isArray(locations) || !locations.length) throw new Error('Manifest sin "locations".');
  if (!Array.isArray(jobs) || !jobs.length) throw new Error('Manifest sin "jobs".');

  const categoryMap = await loadCategoryMap();

  // Valida TODAS las categorías antes de empezar a scrapear (falla temprano).
  // Sin "queries" en el job → usa el nombre de la categoría como query.
  const resolved = jobs.map((job) => {
    const cat = resolveCategory(job.category, categoryMap);
    const queries = job.queries?.length ? job.queries : [cat.name];
    return { cat, queries };
  });

  const totalRuns = resolved.reduce(
    (acc, j) => acc + j.queries.length * locations.length,
    0,
  );
  console.log(
    `Manifest: ${resolved.length} categoría(s), ${locations.length} ubicación(es) → ${totalRuns} corrida(s).`,
  );
  const mode = fromOutput
    ? 'Modo --from-output: inserta desde los JSONs del dry-run (sin re-scrapear).'
    : push
      ? 'Modo --push: scrapea e inserta directo en Supabase.'
      : 'Modo dry-run: guarda JSON, no inserta.';
  console.log(`${mode}\n`);

  if (push) {
    await confirmPush(resolved, locations);
  }

  let run = 0;
  for (const job of resolved) {
    for (const location of locations) {
      const municipio = municipioFromLocation(location);
      for (const query of job.queries) {
        run += 1;
        // En --from-output saltamos queries sin JSON (dieron 0 results en dry-run).
        if (fromOutput && !existsSync(outFileFor(query, location))) {
          console.log(`\n[${run}/${totalRuns}] "${query}" en "${location}" → sin JSON, saltado.`);
          continue;
        }
        console.log(
          `\n[${run}/${totalRuns}] "${query}" en "${location}" → categoría "${job.cat.name}" (${job.cat.id})`,
        );
        await runScraper({ query, location, categoryId: job.cat.id, municipio });
      }
    }
  }

  console.log('\nListo. Semilla completa.');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
