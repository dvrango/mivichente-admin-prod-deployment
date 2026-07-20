import { FieldNewBusiness } from '@/features/field/components/field-new-business'

export const metadata = { title: 'Negocio nuevo — campo' }

export default async function CampoNuevoPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const { name } = await searchParams
  return <FieldNewBusiness initialName={name ?? ''} />
}
