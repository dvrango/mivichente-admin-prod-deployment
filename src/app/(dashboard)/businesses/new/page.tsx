import { PageHeader } from '@/components/shared/page-header'
import { getCurrentProfile } from '@/features/auth/queries'
import { createBusiness } from '@/features/businesses/actions'
import { BusinessForm } from '@/features/businesses/components/business-form'
import { getActiveCategoryOptions } from '@/features/businesses/queries'
import { MUNICIPIOS } from '@/features/businesses/schema'

// Los parámetros con los que `approveRegistration` precarga este form cuando la
// solicitud no traía `business_id` (ver registrations/actions.ts). Sin ellos la
// página es el alta normal de siempre.
type NewBusinessSearchParams = {
  fromRegistration?: string
  name?: string
  phone?: string
  municipio?: string
  contact_name?: string
  contact_phone?: string
  description?: string
  /** Ofertas declaradas por el dueño, separadas por `|`. */
  offerings?: string
  giro?: string
  /**
   * Fotos que subió el dueño (hasta 3), ya copiadas al bucket público por
   * `approveRegistration` y separadas por `|`. Viajan como URLs porque los
   * archivos no caben en un query param — y así el form las trata como
   * cualquier foto ya subida. La primera es la portada.
   */
  photo_urls?: string
  /**
   * Cuántas fotos del dueño no se pudieron copiar al aprobar. Siguen en la
   * solicitud; sin este aviso el admin guardaría creyendo que no mandó fotos.
   */
  photos_missing?: string
  address?: string
  facebook_url?: string
  instagram_url?: string
  /**
   * Horario tal como lo escribió el dueño. No hay campo donde precargarlo
   * —`business_hours` son filas por día— así que viaja para mostrarse como
   * aviso y que quien llena el form lo capture en el editor de horarios.
   */
  hours_note?: string
}

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<NewBusinessSearchParams>
}) {
  const params = await searchParams
  const [categories, profile] = await Promise.all([getActiveCategoryOptions(), getCurrentProfile()])
  const lockedMunicipio =
    profile?.role === 'reviewer' ? (profile.municipio ?? undefined) : undefined

  // Reviewer sin municipio asignado: todo insert fallaría en el RLS
  // (municipio = NULL nunca matchea). Se bloquea el form con un aviso claro.
  if (profile?.role === 'reviewer' && !profile.municipio) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Nuevo negocio"
          breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: 'Nuevo' }]}
        />
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Tu cuenta todavía no tiene un municipio asignado, así que no puedes dar de alta negocios.
          Pídele al administrador que te asigne uno.
        </p>
      </div>
    )
  }

  const fromRegistration = params.fromRegistration
  const municipio = (MUNICIPIOS as readonly string[]).includes(params.municipio ?? '')
    ? params.municipio
    : undefined
  const defaults = fromRegistration
    ? {
        name: params.name ?? '',
        phone: params.phone ?? '',
        municipio,
        description: params.description ?? '',
        offerings: params.offerings ? params.offerings.split('|').filter(Boolean) : [],
        owner: params.contact_name ?? '',
        owner_phone: params.contact_phone ?? '',
        address: params.address ?? '',
        facebook_url: params.facebook_url ?? '',
        instagram_url: params.instagram_url ?? '',
      }
    : undefined

  // La galería arranca con las fotos del dueño ya cargadas: `url` puesta y
  // `file` en null es exactamente la forma de una foto que ya vive en storage,
  // así que el guardado les crea sus filas en `business_photos` por el camino
  // de siempre, en este orden. Sin caption — nadie las tituló, y el admin puede
  // escribirlas antes de guardar.
  const photoUrls =
    fromRegistration && params.photo_urls ? params.photo_urls.split('|').filter(Boolean) : []
  const photosMissing = fromRegistration ? Number.parseInt(params.photos_missing ?? '', 10) || 0 : 0
  const defaultPhotos =
    photoUrls.length > 0
      ? photoUrls.map((url) => ({ url, file: null, previewUrl: url, caption: '' }))
      : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo negocio"
        breadcrumbs={[{ label: 'Negocios', href: '/businesses' }, { label: 'Nuevo' }]}
        description={
          fromRegistration
            ? `Precargado con lo que mandó el dueño en su solicitud${
                params.giro ? ` · giro declarado: ${params.giro}` : ''
              }. Revisa, elige categoría y guarda — al guardar, la solicitud queda aprobada.`
            : undefined
        }
      />

      {/* Si la copia al bucket público falló, las fotos que faltan siguen en la
          solicitud. Se avisa aquí porque el form, sin ellas, se ve igual que
          una solicitud que no traía fotos. */}
      {fromRegistration && photosMissing > 0 && (
        <div
          role="alert"
          className="border-destructive/50 text-destructive rounded-md border p-4 text-sm"
        >
          <p className="font-medium">
            {photosMissing === 1
              ? 'No se pudo traer 1 foto que mandó el dueño.'
              : `No se pudieron traer ${photosMissing} fotos que mandó el dueño.`}
          </p>
          <p className="mt-1">
            Siguen guardadas en la solicitud. Sal de aquí sin guardar y vuelve a aprobarla desde
            Solicitudes, o descárgalas desde ahí y súbelas aquí antes de guardar. No guardes este
            form y otro de la misma solicitud: se crearían dos negocios.
          </p>
        </div>
      )}

      {/* El horario es el único dato de la solicitud que no se puede precargar:
          `business_hours` son filas por día con turnos partidos y el dueño lo
          escribió en una línea. Se muestra aquí porque en esta pantalla ya no
          tiene la solicitud enfrente — si no, el dato se pierde. */}
      {fromRegistration && params.hours_note && (
        <div className="rounded-md border border-dashed p-4 text-sm">
          <p className="font-medium">El dueño dijo su horario así:</p>
          <p className="text-muted-foreground mt-1">{params.hours_note}</p>
          <p className="text-muted-foreground mt-2">
            No se puede precargar solo — captúralo abajo en el editor de horarios.
          </p>
        </div>
      )}
      <BusinessForm
        action={createBusiness}
        submitLabel="Crear"
        categories={categories}
        lockedMunicipio={lockedMunicipio}
        registrationId={fromRegistration}
        registrationPhotosComplete={photosMissing === 0}
        defaults={defaults}
        defaultPhotos={defaultPhotos}
      />
    </div>
  )
}
