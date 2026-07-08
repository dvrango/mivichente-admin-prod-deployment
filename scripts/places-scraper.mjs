#!/usr/bin/env node
// Scrapea negocios de Google Places (New) API y arma filas listas pa Supabase.
//
// Uso:
//   node scripts/places-scraper.mjs --query "Taquerias" --location "Vicente Guerrero, Durango"
//   node scripts/places-scraper.mjs --query "Hamburguesas" --location "Vicente Guerrero, Durango" --push
//   node scripts/places-scraper.mjs --query "Taquerias" --location "Vicente Guerrero, Durango" --category-id "uuid-de-categoria" --push
//
// Env requerido:
//   GOOGLE_PLACES_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL          (solo si usas --push)
//   SUPABASE_SERVICE_ROLE_KEY         (solo si usas --push)
//
// Flags:
//   --query      texto de búsqueda, ej "Taquerias" (requerido)
//   --location   lugar donde buscar, ej "Vicente Guerrero, Durango" (requerido)
//   --municipio  valor pa columna businesses.municipio (default "Vicente Guerrero")
//   --max-pages  máximo de páginas a paginar, 20 resultados c/u (default 1, tope Google 3)
//   --out        carpeta de salida (default ./scripts/output)
//   --out-file   ruta exacta del JSON de salida (override de --out, sin --push)
//   --category-id  UUID de categoría a asignar a los negocios insertados (opcional)
//   --limit      tope de negocios a insertar (solo con --push; pa pruebas)
//   --created-by profile id del admin pa created_by/updated_by (si no, quedan NULL = "desconocido")
//   --push       si se pasa, sube fotos a Storage e inserta directo en Supabase
//
// Sin --push: guarda JSON con las filas listas + descarga fotos localmente.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const MX_PHONE_DIGITS = 10;

function normalizeMxPhone(value) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length <= MX_PHONE_DIGITS) return digits;
  if (digits.startsWith('521')) return digits.slice(3, 3 + MX_PHONE_DIGITS);
  if (digits.startsWith('52')) return digits.slice(2, 2 + MX_PHONE_DIGITS);
  return digits.slice(0, MX_PHONE_DIGITS);
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('Falta GOOGLE_PLACES_API_KEY en env.');
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args['from-file'] && (!args.query || !args.location)) {
  console.error(
    'Uso: node places-scraper.mjs --query "Taquerias" --location "Vicente Guerrero, Durango" [--push]\n' +
      '  o: node places-scraper.mjs --from-file scripts/output/hamburguesas.json --push',
  );
  process.exit(1);
}

const municipio = args.municipio ?? 'Vicente Guerrero';
const maxPages = Number(args['max-pages'] ?? 1);
const outDir = args.out ?? path.join(process.cwd(), 'scripts', 'output');
const photosDir = path.join(outDir, 'photos');
const push = Boolean(args.push);
const categoryId = args['category-id'] ?? null;
const createdBy = args['created-by'] ?? null; // profile id del admin (created_by/updated_by)
const limit = args.limit ? Number(args.limit) : null; // tope de negocios a insertar (test)

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.nationalPhoneNumber',
  'places.formattedAddress',
  'places.regularOpeningHours',
  'places.googleMapsUri',
  'places.photos',
  'nextPageToken',
].join(',');

async function searchPlaces() {
  const results = [];
  let pageToken;
  let page = 0;

  do {
    const body = {
      textQuery: `${args.query} en ${args.location}`,
      languageCode: 'es',
      ...(pageToken ? { pageToken } : {}),
    };

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Places search falló (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    results.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    page += 1;
    console.log(`  página ${page}: ${data.places?.length ?? 0} resultado(s) (acum ${results.length})`);

    // Google requiere esperar antes de que el nextPageToken sea válido.
    if (pageToken && page < maxPages) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  } while (pageToken && page < maxPages);

  return results;
}

async function downloadPhoto(photoName, destPath) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1080&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Photo download falló (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

function dayHourToTime({ hour = 0, minute = 0 }) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toBusinessHours(place) {
  const periods = place.regularOpeningHours?.periods ?? [];
  return periods
    .filter((p) => p.open && p.close)
    .map((p) => ({
      day_of_week: p.open.day,
      opens_at: dayHourToTime(p.open),
      closes_at: dayHourToTime(p.close),
    }));
}

async function toBusinessRow(place, photoLocalPath) {
  return {
    _place_id: place.id,
    name: place.displayName?.text ?? '',
    phone: normalizeMxPhone(place.nationalPhoneNumber),
    phone_is_whatsapp: false,
    address: place.formattedAddress ?? null,
    maps_url: place.googleMapsUri ?? null,
    photo_url: photoLocalPath ?? null,
    category_id: categoryId,
    municipio,
    data_source: 'scraping',
    is_active: false,
    is_verified: false,
  };
}

function isInTargetMunicipio(address) {
  if (!address) return false;
  const addr = address.toLowerCase();
  return (
    addr.includes('villa unión') ||
    addr.includes('villa union') ||
    addr.includes('vicente guerrero') ||
    addr.includes('nombre de dios')
  );
}

function validateBusiness(biz) {
  if (!biz.name || !biz.name.trim()) return 'sin nombre';
  if (!biz.phone || !biz.phone.trim()) return 'sin telefono (columna NOT NULL en businesses)';
  if (!biz.address) return 'sin address';
  if (!isInTargetMunicipio(biz.address)) return `fuera de municipio target: "${biz.address}"`;
  if (biz.phone.length !== MX_PHONE_DIGITS) return `telefono no tiene 10 digitos: "${biz.phone}"`;
  return null;
}

async function pushToSupabase(businesses, hoursByPlaceId, photosByPlaceId) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const toInsert = limit ? businesses.slice(0, limit) : businesses;
  for (const biz of toInsert) {
    const validationError = validateBusiness(biz);
    if (validationError) {
      console.error(`  ✗ "${biz.name || biz._place_id}" saltado: ${validationError}`);
      continue;
    }

    const { data: dupe } = await supabase
      .from('businesses')
      .select('id')
      .eq('phone', biz.phone)
      .maybeSingle();
    if (dupe) {
      console.error(`  ✗ "${biz.name}" saltado: ya existe negocio con ese telefono (${dupe.id})`);
      continue;
    }

    let photoUrl = null;
    const localPhoto = photosByPlaceId[biz._place_id];
    if (localPhoto) {
      const fileName = `${biz._place_id}.jpg`;
      const fileBuf = await import('node:fs/promises').then((fs) => fs.readFile(localPhoto));
      const { error: upErr } = await supabase.storage
        .from('business-photos')
        .upload(fileName, fileBuf, { contentType: 'image/jpeg', upsert: true });
      if (upErr) {
        console.error(`  ! foto falló pa "${biz.name}": ${upErr.message}`);
      } else {
        photoUrl = supabase.storage.from('business-photos').getPublicUrl(fileName).data.publicUrl;
      }
    }

    const { _place_id, ...row } = biz;
    row.photo_url = photoUrl;
    if (createdBy) {
      row.created_by = createdBy;
      row.updated_by = createdBy;
    }

    const { data: inserted, error } = await supabase
      .from('businesses')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error(`  ! insert falló pa "${biz.name}": ${error.message}`);
      continue;
    }

    // La categoría vive en business_categories (fuente de verdad: filtro de lista
    // y form de edición leen de ahí). businesses.category_id ya quedó denormalizado
    // en el insert de arriba, pero sin esta fila el negocio no aparece al filtrar.
    if (biz.category_id) {
      const { error: catErr } = await supabase.from('business_categories').insert({
        business_id: inserted.id,
        category_id: biz.category_id,
        is_primary: true,
      });
      if (catErr) console.error(`  ! categoría falló pa "${biz.name}": ${catErr.message}`);
    }

    const hours = hoursByPlaceId[_place_id] ?? [];
    if (hours.length) {
      const hourRows = hours.map((h) => ({ ...h, business_id: inserted.id }));
      const { error: hoursErr } = await supabase.from('business_hours').insert(hourRows);
      if (hoursErr) console.error(`  ! horario falló pa "${biz.name}": ${hoursErr.message}`);
    }

    console.log(`  ✓ "${biz.name}" insertado (${inserted.id})`);
  }
}

async function main() {
  if (args['from-file']) {
    console.log(`Cargando "${args['from-file']}"...`);
    const raw = JSON.parse(await readFile(args['from-file'], 'utf-8'));
    const businesses = raw.businesses;
    if (categoryId) {
      for (const biz of businesses) biz.category_id = categoryId;
    }
    const hoursByPlaceId = raw.business_hours_by_place_id ?? {};
    const photosByPlaceId = {};
    for (const biz of businesses) {
      if (biz.photo_url) photosByPlaceId[biz._place_id] = biz.photo_url;
    }

    if (!push) {
      console.log('Nada que hacer sin --push cuando usas --from-file (los datos ya están en el JSON).');
      return;
    }

    console.log('Insertando directo en Supabase...');
    await pushToSupabase(businesses, hoursByPlaceId, photosByPlaceId);
    return;
  }

  console.log(`Buscando "${args.query}" en "${args.location}"...`);
  const places = await searchPlaces();
  console.log(`${places.length} resultado(s).`);

  if (!places.length) return;

  await mkdir(photosDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const businesses = [];
  const hoursByPlaceId = {};
  const photosByPlaceId = {};

  let idx = 0;
  for (const place of places) {
    idx += 1;
    console.log(`  [${idx}/${places.length}] ${place.displayName?.text ?? place.id}`);
    let localPhotoPath = null;
    const firstPhoto = place.photos?.[0];
    if (firstPhoto) {
      localPhotoPath = path.join(photosDir, `${place.id}.jpg`);
      try {
        await downloadPhoto(firstPhoto.name, localPhotoPath);
        photosByPlaceId[place.id] = localPhotoPath;
      } catch (err) {
        console.error(`  ! foto falló pa "${place.displayName?.text}": ${err.message}`);
        localPhotoPath = null;
      }
    }

    businesses.push(await toBusinessRow(place, localPhotoPath));
    hoursByPlaceId[place.id] = toBusinessHours(place);
  }

  const inMunicipio = businesses.filter((biz) => {
    if (isInTargetMunicipio(biz.address)) return true;
    console.error(`  ✗ "${biz.name}" fuera de municipio target: "${biz.address}"`);
    return false;
  });
  businesses.length = 0;
  businesses.push(...inMunicipio);

  if (push) {
    console.log('Insertando directo en Supabase...');
    await pushToSupabase(businesses, hoursByPlaceId, photosByPlaceId);
  } else {
    // --out-file permite al runner (scrape-seed.mjs) dar un nombre único por
    // query+ubicación; sin él dos ubicaciones con la misma query se pisan.
    const outFile =
      args['out-file'] ??
      path.join(outDir, `${args.query.toLowerCase().replace(/\s+/g, '-')}.json`);
    await writeFile(
      outFile,
      JSON.stringify({ businesses, business_hours_by_place_id: hoursByPlaceId }, null, 2),
    );
    console.log(`Guardado: ${outFile}`);
    console.log(`Fotos en: ${photosDir}`);
    console.log('Corre de nuevo con --push pa insertar directo en Supabase.');
  }
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
  console.error(err);
  process.exit(1);
});
