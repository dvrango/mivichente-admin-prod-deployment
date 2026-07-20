import type { Viewport } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'

// Grupo de rutas hermano de (dashboard) a propósito: el modo campo se usa a una
// mano, parado en la calle, y necesita la pantalla completa. Anidarlo bajo
// (dashboard) traería sidebar, topbar, padding y max-w-7xl que habría que
// deshacer. `proxy.ts` igual protege estas rutas (su matcher sólo excluye
// archivos con extensión), así que el redirect a /login sigue saliendo gratis.

export const viewport: Viewport = {
  // Sin `maximumScale: 1`: bloquear el zoom rompe accesibilidad. El zoom
  // automático de iOS al enfocar se evita con inputs de 16px (text-base).
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Mismo callejón sin salida que en /businesses/new: sin municipio, todo insert
  // o update fallaría por RLS. Mejor decirlo aquí que al momento de guardar.
  if (profile.role !== 'admin' && !profile.municipio) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">Sin municipio asignado</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Tu usuario todavía no tiene municipio. Pídele a un admin que te lo asigne para poder
          capturar negocios en campo.
        </p>
      </div>
    )
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
}
