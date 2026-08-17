type Props = {
  values: number[]
  width?: number
  height?: number
}

// Serie mínima: sin ejes ni leyenda (una sola serie, el número grande de al
// lado ya la nombra). `<title>` por punto da el valor exacto al pasar el
// mouse sin construir una capa de tooltip aparte — proporcional a una
// herramienta interna que se lee ~1 vez por semana.
export function Sparkline({ values, width = 120, height = 32 }: Props) {
  if (values.length < 2) return null

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const pad = 3

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return { x, y, v }
  })

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="text-muted-foreground"
      role="img"
      aria-label={`Tendencia, últimas ${values.length} semanas: ${values.join(', ')}`}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3 : 2} fill="currentColor">
          <title>{p.v}</title>
        </circle>
      ))}
      <circle cx={last.x} cy={last.y} r={4} className="fill-foreground" />
    </svg>
  )
}
