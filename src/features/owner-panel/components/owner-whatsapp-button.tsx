import { MessageCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ownerWhatsappLink, type OwnerWhatsappTopic } from '../whatsapp'

export function OwnerWhatsappButton({
  businessName,
  topic,
  section,
  label,
  variant = 'outline',
  className,
}: {
  businessName: string
  topic: OwnerWhatsappTopic
  /** Sección desde la que se toca, para los botones de `cambio`. */
  section?: string
  label: string
  variant?: 'default' | 'outline'
  className?: string
}) {
  return (
    <a
      href={ownerWhatsappLink(businessName, topic, section)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size: 'sm' }), className)}
    >
      <MessageCircle className="size-4" />
      {label}
    </a>
  )
}
