import { ChevronDown } from 'lucide-react'
import { OWNER_FAQ } from '../faq'

// `<details>` nativo: abre y cierra sin JavaScript y el texto queda en el HTML,
// así que el buscador del navegador también lo encuentra.
export function OwnerFaq() {
  return (
    <div className="bg-card divide-y rounded-xl border">
      {OWNER_FAQ.map((item) => (
        <details key={item.q} className="group px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="text-muted-foreground pb-3 text-sm">{item.a}</p>
        </details>
      ))}
    </div>
  )
}
