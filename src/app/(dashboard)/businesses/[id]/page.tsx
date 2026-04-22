export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div>
      <h1 className="text-2xl font-semibold">Editar negocio</h1>
      <p className="text-muted-foreground text-sm mt-2">ID: {id} — por implementar en T1.3</p>
    </div>
  )
}
