// Secciones del form de la ficha del negocio. Viven fuera de `business-form.tsx`
// porque ese archivo es `'use client'` y la página (server) también las lee
// para pintar el índice lateral. Los `id` son las anclas del índice.

export type BusinessFormSection = { id: string; title: string }

export const BUSINESS_FORM_SECTIONS = {
  identidad: { id: 'identidad', title: 'Identidad' },
  contacto: { id: 'contacto', title: 'Contacto' },
  ubicacion: { id: 'ubicacion', title: 'Ubicación' },
  busqueda: { id: 'busqueda', title: 'Búsqueda' },
  horarioFotos: { id: 'horario-fotos', title: 'Horario y fotos' },
  envio: { id: 'envio', title: 'Envío' },
} as const satisfies Record<string, BusinessFormSection>

/** Las secciones en el orden en que aparecen. «Envío» solo existe si el negocio entrega. */
export function businessFormSections({
  hasDelivery,
}: {
  hasDelivery: boolean
}): BusinessFormSection[] {
  const s = BUSINESS_FORM_SECTIONS
  return [
    s.identidad,
    s.contacto,
    s.ubicacion,
    s.busqueda,
    s.horarioFotos,
    ...(hasDelivery ? [s.envio] : []),
  ]
}
