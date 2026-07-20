// Semilla de sugerencias de oferta. Existe porque las sugerencias derivadas de
// la DB (`getOfferingSuggestions`) hoy devuelven casi nada: la mayoría de los
// negocios scrapeados no tiene offerings, que es justo el problema que el modo
// campo viene a resolver. La semilla lo hace útil el día uno; la DB lo hace
// útil dentro de unos meses.
//
// Se busca por coincidencia de substring en el nombre de la categoría, y si no
// pega ninguna, cae al set genérico del tipo.

const BY_CATEGORY_NAME: { match: string[]; offerings: string[] }[] = [
  {
    match: ['taquer', 'taco'],
    offerings: ['tacos', 'quesadillas', 'burritos', 'gringas', 'consomé', 'salsas'],
  },
  {
    match: ['marisc', 'pescad'],
    offerings: [
      'ceviche',
      'camarones',
      'cóctel de camarón',
      'pescado frito',
      'aguachile',
      'tostadas',
    ],
  },
  {
    match: ['pizz'],
    offerings: ['pizza', 'alitas', 'pan de ajo', 'refrescos', 'espagueti'],
  },
  {
    match: ['pollo', 'asader', 'rostic'],
    offerings: ['pollo asado', 'pollo rostizado', 'papas', 'arroz', 'tortillas', 'salsas'],
  },
  {
    match: ['hamburgues', 'hot dog', 'lonch'],
    offerings: ['hamburguesas', 'hot dogs', 'papas a la francesa', 'tortas', 'refrescos'],
  },
  {
    match: ['panad', 'reposter', 'pastel'],
    offerings: ['pan dulce', 'bolillo', 'pasteles', 'galletas', 'empanadas', 'gelatinas'],
  },
  {
    match: ['abarrot', 'tienda', 'miscel'],
    offerings: ['abarrotes', 'refrescos', 'botanas', 'lácteos', 'pan', 'artículos de limpieza'],
  },
  {
    match: ['carnic'],
    offerings: ['carne de res', 'carne de puerco', 'pollo', 'chorizo', 'carne para asar'],
  },
  {
    match: ['tortiller'],
    offerings: ['tortillas de maíz', 'tortillas de harina', 'masa', 'totopos'],
  },
  {
    match: ['barber', 'estétic', 'salón', 'salon', 'peluqu'],
    offerings: ['corte de cabello', 'barba', 'tinte', 'peinado', 'manicure', 'pedicure'],
  },
  {
    match: ['mecán', 'mecan', 'taller', 'lliant', 'llant'],
    offerings: ['afinación', 'cambio de aceite', 'frenos', 'suspensión', 'reparación de llantas'],
  },
  {
    match: ['ferret'],
    offerings: [
      'herramienta',
      'pintura',
      'tornillería',
      'plomería',
      'material eléctrico',
      'cemento',
    ],
  },
  {
    match: ['farmac'],
    offerings: ['medicamentos', 'consulta médica', 'material de curación', 'genéricos'],
  },
  {
    match: ['papeler'],
    offerings: ['copias', 'impresiones', 'útiles escolares', 'engargolados', 'papelería'],
  },
  {
    match: ['ropa', 'boutiq'],
    offerings: ['ropa de dama', 'ropa de caballero', 'ropa infantil', 'calzado', 'accesorios'],
  },
  {
    match: ['event', 'fiest', 'salón de'],
    offerings: ['renta de sillas', 'renta de mesas', 'renta de mantelería', 'sonido', 'banquetes'],
  },
]

const BY_TYPE: Record<string, string[]> = {
  food: ['desayunos', 'comida corrida', 'antojitos', 'bebidas', 'servicio a domicilio'],
  business: ['venta', 'reparación', 'servicio a domicilio', 'mayoreo', 'entrega'],
}

/** Sugerencias semilla para una categoría. `type` es 'food' | 'business'. */
export function seedOfferings(categoryName: string | null, type: string | null): string[] {
  const name = (categoryName ?? '').toLowerCase()
  if (name) {
    const hit = BY_CATEGORY_NAME.find((entry) => entry.match.some((m) => name.includes(m)))
    if (hit) return hit.offerings
  }
  return BY_TYPE[type ?? 'business'] ?? BY_TYPE.business
}
