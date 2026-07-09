// Espeja el lower(unaccent(...)) de la RPC de Postgres y el normalizeText de
// mobile: minusculas, sin acentos, trim. Usalo para comparar terminos que la
// gente escribe distinto (mayusculas, tildes, espacios).
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
