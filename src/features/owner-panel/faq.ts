/**
 * Preguntas frecuentes del panel del dueño. Cada respuesta sale de una nota del
 * vault (decisiones y guías de `06 Guías y Procesos/`); si una de esas cambia,
 * la respuesta de aquí cambia con ella.
 *
 * Fuera a propósito: «¿cuánto cuesta?». El vault se contradice (la guía dice
 * «hoy no tiene costo», Idea_Principal habla de «gratis para siempre» a los
 * fundadores y de un premium de pago) y no se responde hasta que se decida.
 */
export const OWNER_FAQ: { q: string; a: string }[] = [
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
    a: 'No, este panel es para que veas cómo aparece tu negocio en Vichente. Si ves algo mal o quieres cambiar tus datos, fotos, menú o precios, escríbenos por WhatsApp con el botón del panel y nosotros hacemos el cambio.',
  },
  {
    q: '¿Qué hago si cambia mi horario?',
    a: 'Avísanos por WhatsApp para actualizarlo. Es importante tenerlo al día: si tu horario dice que a esa hora estás cerrado, la app no deja que te manden pedidos, aunque en realidad estés abierto. Si no tienes horario fijo o atiendes con cita, también lo podemos poner así.',
  },
  {
    q: '¿Quién ve las opiniones de mis clientes?',
    a: 'Tú y el equipo de Vichente. Las opiniones que te dejan tus clientes son privadas: no se publican en tu ficha ni en ninguna parte de la app. Si todavía no recibes opiniones y te interesa, escríbenos por WhatsApp.',
  },
  {
    q: '¿Por qué no veo cuánta gente visita mi negocio?',
    a: 'Por ahora el panel no muestra esa información. Si quieres saber cómo le va a tu ficha, pídenoslo por WhatsApp y te lo platicamos.',
  },
  {
    q: '¿Cómo consigo el QR para mis mesas?',
    a: 'Pídelo por WhatsApp con el botón del panel. El QR abre tu menú en el celular de tus clientes para que lo consulten; los pedidos se hacen desde la app. Si todavía no tienes tu menú en Vichente, primero lo capturamos.',
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
    a: 'En «Tus links» cada uno dice para qué sirve. En corto: tu página es para tus redes; el de tu negocio en la app, para quien te pregunta «¿me mandas el menú?» si tienes pedidos activados; el del menú, para que lo consulten; y el de descargar, para quien quiera Vichente en su celular.',
  },
]
