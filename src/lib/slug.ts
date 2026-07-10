// Slug de negocio para URLs root-level (vichente.com/el-tunner).
// La fuente de verdad es el trigger en la DB (migration add_business_slug);
// esto lo replica en el cliente/servidor del admin para validar antes de
// guardar y dar un mensaje claro. Mantener la blocklist en sync con
// public.slug_is_reserved() en SQL.

export const RESERVED_SLUGS = [
  'legal',
  'support',
  'negocio',
  'api',
  'admin',
  'www',
  'app',
  'about',
  'privacy',
  'terms',
  '_next',
  'static',
  'public',
  'assets',
  'favicon',
  'robots',
  'sitemap',
  'index',
  'home',
  'contact',
  'help',
  'login',
  'signup',
  'register',
  'registrar-negocio',
  'business',
  'search',
  'explorar',
  'vichente',
] as const

// Un slug válido: minúsculas, dígitos y guiones simples, sin guion al inicio/fin.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Combining diacritical marks (U+0300–U+036F), lo que deja NFD tras separar acentos.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

// Normaliza cualquier texto a slug: sin acentos, minúsculas, no-alfanumérico → guion.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug)
}
