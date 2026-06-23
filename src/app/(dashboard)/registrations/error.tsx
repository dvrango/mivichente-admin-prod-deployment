'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <div className="text-destructive py-8 text-center">
      Error al cargar solicitudes: {error.message}
    </div>
  )
}
