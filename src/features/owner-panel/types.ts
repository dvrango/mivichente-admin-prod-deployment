// Forma del JSON que devuelve `owner_business_snapshot()`. La función es la
// fuente de verdad (`20261022120000_owner_read_only_panel`); los tipos
// generados la declaran como `Json`, así que aquí se describe a mano.

export type OwnerBusinessSummary = {
  id: string
  name: string
  slug: string | null
}

export type OwnerHour = {
  day_of_week: number
  /** `HH:MM:SS` */
  opens_at: string
  closes_at: string
}

export type OwnerPhoto = {
  id: string
  url: string
  caption: string | null
  kind: string
}

export type OwnerService = {
  id: string
  name: string
  description: string | null
  price: number | null
  section: string | null
  show_in_profile: boolean
  variants: { name: string; price: number }[]
  option_groups: { name: string; options: { name: string; price_delta: number }[] }[]
}

export type OwnerFeedback = {
  rating: number
  liked: string | null
  improve: string | null
  created_at: string
}

export type OwnerBusinessSnapshot = {
  business: {
    id: string
    name: string
    slug: string | null
    description: string | null
    category: string | null
    phone: string | null
    phone_is_whatsapp: boolean | null
    whatsapp_phone: string | null
    address: string | null
    colonia: string | null
    municipio: string | null
    maps_url: string | null
    facebook_url: string | null
    instagram_url: string | null
    photo_url: string | null
    offerings: string[] | null
    services_label: string | null
    has_delivery: boolean | null
    is_active: boolean
    promo_active: boolean
    promo_title: string | null
    promo_body: string | null
    promo_ends_at: string | null
  }
  hours: OwnerHour[]
  photos: OwnerPhoto[]
  services: OwnerService[]
  feedback: { total: number; recent: OwnerFeedback[] }
}
