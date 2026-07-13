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
}
