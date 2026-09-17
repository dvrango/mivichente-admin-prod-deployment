'use client'

/**
 * Botón de opción excluyente: sección, visibilidad, y las dos preguntas de un
 * grupo de opciones.
 *
 * Vivía dentro de `menu-item-form.tsx` sin exportar. Salió a su propio archivo
 * cuando `option-groups-field.tsx` lo necesitó — copiarlo habría dejado dos
 * definiciones que se separan al primer ajuste de estilo, en controles que el
 * usuario ve uno junto al otro en la misma tarjeta.
 *
 * `min-h-9` y no `h-9`: la etiqueta puede envolver a dos líneas en móvil
 * ("En la app y en el menú del QR") y con altura fija el texto se sale.
 */
export function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3 py-1.5 text-sm disabled:opacity-50 ${
        active ? 'bg-primary text-primary-foreground border-transparent' : 'border-input'
      }`}
    >
      {children}
    </button>
  )
}
