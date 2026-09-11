// Pantalla para la cuenta que existe pero todavía no tiene rol.
//
// Desde `20260911120000_lock_down_authenticated_access`, registrarse deja el
// perfil en rol `pending`: la sesión es válida, y la DB no le devuelve una sola
// fila. Sin esta pantalla el panel se vería vacío y roto (la navegación no sabe
// qué pintarle a un rol que no es admin ni reviewer), y el usuario leería un
// bug donde en realidad hay un permiso que falta.
//
// Hermana de la de "Sin municipio asignado" del modo campo: mismo problema —
// la cuenta no puede trabajar hasta que un admin toque su perfil— y misma forma
// de decirlo.
export function PendingAccountNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-semibold">Cuenta sin permisos</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Tu cuenta ya existe, pero todavía no tiene un rol asignado. Pídele a un admin que te dé
        acceso y te asigne tu municipio.
      </p>
    </div>
  )
}
