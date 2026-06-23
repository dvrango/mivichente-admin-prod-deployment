export type RegistrationStatus = 'pending' | 'reviewed' | 'approved' | 'rejected'

export type BusinessRegistration = {
  id: string
  business_name: string
  description: string
  phone: string
  contact_phone: string | null
  contact_name: string
  municipio: string
  status: RegistrationStatus
  notes: string | null
  created_at: string
}
