/**
 * FAQ of the owner panel. Each answer comes from a vault note (decisions and the
 * guides in `06 Guías y Procesos/`); when one of those changes, its answer here
 * changes with it.
 *
 * Cost: being in Vichente (listing, menu, stickers) is free, per the 2026-10-29
 * decision «Hoy Vichente es gratis para el negocio, igual que los stickers que
 * entregamos». Since 2026-11-12 some services have a price (the stamp card).
 * The user approved this answer on 2026-11-12 and asked that it name no service
 * and no price: prices are still being tested, and the text has to stay true
 * when they change or a new paid service is added. Never promise free forever.
 */
export const OWNER_FAQ: { q: string; a: string }[] = [
  {
    q: '¿Cuánto me cuesta estar en Vichente?',
    a: 'Estar en Vichente no te cuesta nada. Algunos servicios tienen costo, y siempre te lo decimos antes de activarlos.',
  },
  {
    q: '¿Cómo me llegan los pedidos hoy?',
    a: 'Si tu negocio tiene los pedidos activados, el cliente arma su pedido en la app y te llega a tu WhatsApp como un mensaje ya escrito, con lo que pidió, el total y, si es a domicilio, la ubicación marcada en un mapa. Desde ahí lo atiendes, lo cobras y lo entregas como siempre: Vichente no maneja el dinero ni manda repartidores.',
  },
  {
    q: '¿Puedo recibir los pedidos aquí en el panel?',
    a: 'Todavía no. Es una función que estamos construyendo, y mientras tanto los pedidos te siguen llegando por WhatsApp. Si te interesa, toca «Me interesa» en esa tarjeta y nos llega tu mensaje.',
  },
  {
    q: '¿Cómo activo los pedidos en mi negocio?',
    a: 'Escríbenos por WhatsApp con el botón del panel. Primero capturamos tu menú con sus precios, porque lo que no tiene precio no se puede pedir, y después vemos contigo si se pueden activar.',
  },
  {
    q: '¿Puedo cambiar mi información yo mismo?',
    a: 'No, este panel es para que veas cómo aparece tu negocio en Vichente. Si ves algo mal o quieres cambiar tus datos, fotos, menú o precios, toca «Quiero cambiar algo» en la sección que quieras corregir y nosotros hacemos el cambio.',
  },
  {
    q: '¿Qué hago si cambia mi horario?',
    a: 'Avísanos por WhatsApp para actualizarlo. Es importante tenerlo al día: si tu horario dice que a esa hora estás cerrado, la app no deja que te manden pedidos, aunque en realidad estés abierto. Si no tienes horario fijo o atiendes con cita, también lo podemos poner así.',
  },
  {
    q: '¿Quién ve las opiniones de mis clientes?',
    a: 'Tú y el equipo de Vichente. Las opiniones que te dejan tus clientes son privadas: no se publican en tu ficha ni en ninguna parte de la app.',
  },
  {
    q: '¿Cómo empiezo a recibir opiniones?',
    a: 'Escríbenos por WhatsApp con el botón del panel y vemos contigo cómo ponerlo: es un letrero acrílico con su propio QR para tu local, distinto del QR del menú. Tu cliente lo escanea, te deja su opinión desde su celular y, a cambio, recibe un descuento para su siguiente compra. El descuento lo acordamos contigo.',
  },
  {
    q: '¿Por qué no veo cuánta gente visita mi negocio?',
    a: 'Por ahora el panel no muestra esa información. Si quieres saber cómo le va a tu ficha, pídenoslo por WhatsApp y te lo platicamos.',
  },
  {
    q: '¿Cómo consigo el QR para mis mesas?',
    a: 'Pídelo por WhatsApp con el botón del panel. El QR abre tu menú en el celular de tus clientes para que lo consulten; los pedidos se hacen desde la app. Si todavía no tienes tu menú en Vichente, primero lo capturamos. Los stickers que te entregamos son gratis; si necesitas más, pregúntanos.',
  },
  {
    q: '¿Qué es la tarjeta de sellos?',
    a: 'Es una tarjeta digital: tu cliente la obtiene escaneando un QR en tu mostrador, sin instalar nada, y tú le das un sello desde tu panel cada vez que te compra. Cuando junta los sellos, gana un premio que tú eliges y que corre por cuenta de tu negocio. Todavía está en construcción; si te interesa, toca «Me interesa».',
  },
  {
    q: '¿Cómo publico una promoción?',
    a: 'Mándanos por WhatsApp el título, los detalles y, si quieres, hasta qué día dura, y la publicamos en tu ficha de la app. El descuento no se aplica solo en el pedido: lo aplicas tú cuando te llega el pedido por WhatsApp.',
  },
  {
    q: '¿Qué link comparto?',
    a: 'El más importante es tu link para que te pidan: mándalo cuando te pregunten «¿me mandas el menú?» y ponlo en tus estados de WhatsApp. En la bio de tu Instagram y Facebook va tu página, que tiene tu dirección, tu horario y tu teléfono. Si ya tienes tu menú en Vichente, el link de tu menú de mesa está en la tarjeta del QR, por si haces tus propios QR.',
  },
]
