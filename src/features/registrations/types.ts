export type RegistrationStatus = 'pending' | 'reviewed' | 'approved' | 'rejected'

export type BusinessRegistration = {
  id: string
  business_name: string
  description: string | null
  phone: string
  contact_phone: string | null
  contact_name: string
  municipio: string
  status: RegistrationStatus
  notes: string | null
  created_at: string
  /** Lo que el dueño dijo que vende. Es el dato que lo hace aparecer en búsquedas. */
  offerings: string[]
  /** Si viene, la solicitud es para un negocio que YA existe: no dar de alta, completar. */
  business_id: string | null
  /** Giro declarado por el dueño. Acota de qué lado del catálogo buscar la categoría. */
  giro: 'comida' | 'comercial' | null
  /**
   * Fotos que subió el dueño (hasta 3), en el bucket privado
   * `registration-photos`. En orden: la primera es la portada. Es staging — al
   * aprobar se copian a `business-photos` y se borran de aquí.
   */
  photo_paths: string[]
  /**
   * URLs firmadas para ver `photo_paths` sin abrir el bucket, en el mismo
   * orden. Las calcula la query, no están en la tabla, y caducan — no guardarlas
   * ni mandarlas a ningún lado.
   */
  photo_preview_urls?: string[]
  /** Dirección en las palabras del dueño. Copia directa a `businesses.address`. */
  address: string | null
  /**
   * Horario en texto libre ("9 a 6, domingos cerrado"). **No se mapea solo** a
   * ninguna columna: `business_hours` son filas por día con turnos partidos, así
   * que quien aprueba lo lee de aquí y lo captura en el editor de horarios.
   */
  hours_note: string | null
  /** Facebook o Instagram; al aprobar se reparte según el dominio. */
  social_url: string | null
}
