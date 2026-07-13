---
# --- METADATA DE PRODUCCION (no se lee en voz alta, es guia interna para quien graba/edita) ---
title: 'Tutorial reviewer: simulador de busqueda y curacion de negocios'
audience: 'Colaboradores reviewer'
format: 'Video con grabacion de pantalla + voz en off (dialogo auto-descriptivo, sirve como guion al grabar en vivo)'
recording_context: 'Grabacion para Villa Union (colaboradora Dani). Ejemplos de negocios abajo son reales, verificados en prod al 2026-07-10.'
estimated_duration: '12:10-12:30'
voice_style: 'Claro, tranquilo, operativo, espanol MX, en primera persona/presente ("damos click", "escribimos", "vemos que...")'
objective: 'Ensenar al reviewer a detectar oportunidades desde el simulador, revisar negocios existentes, activar/corregir fichas y dar altas minimas dentro de su area de influencia.'
scope: 'Solo negocios del area de influencia del colaborador'
---

# Tutorial reviewer: simulador de busqueda y negocios

> **Como leer este documento:** todo lo que esta bajo "Notas para quien graba pantalla" y "Resumen para produccion" es metadata de produccion — contexto y decisiones, no se dice en voz alta. La columna **Guion** de la tabla (y la seccion "Guion corrido") es lo unico que se lee/dice en voz alta, completo, tal cual esta escrito — ya describe la accion que se hace en pantalla ("damos click en...", "escribimos..."), asi que sirve tanto para narrar como para saber que hacer al mismo tiempo si grabas y narras en una sola pasada.

## Resumen para produccion

Este video muestra el flujo real de trabajo de un reviewer. Hay **dos ramas** despues de buscar en el simulador, y el video debe dejarlas claras (no mezclarlas como si fueran un solo camino):

**Rama A — el negocio aparece pero incompleto:**

1. Buscar en el simulador un termino real.
2. Leer los colores de completitud en los resultados (rojo/amarillo/verde).
3. Dar click en un resultado incompleto para abrir su ficha.
4. Corregir categoria, offerings, aliases y estado.
5. Marcar Verificado si ya se confirmo la info con el dueno o en sitio, y Recomendado/Destacado si el negocio realmente sobresale.
6. Revisar el slug/URL publica.
7. Guardar y abrir el link publico.
8. Volver al simulador y confirmar que mejoro.

**Rama B — el negocio no aparece en el simulador:**

1. Buscar en el simulador y no encontrar el negocio.
2. Ir a Negocios y buscarlo ahi para confirmar si ya existe (evitar duplicados).
3. Si existe pero no aparecia bien en el simulador (inactivo, sin offerings, etc.), corregirlo igual que en la Rama A.
4. Si de verdad no existe y el colaborador sabe que deberia estar, darlo de alta con **Nuevo negocio** e informacion minima.
5. Revisar el slug/URL publica generada.
6. Guardar, abrir el link publico y compartirlo con el dueno.
7. Volver al simulador y confirmar que ahora aparece.

Pasos previos comunes a ambas ramas:

1. Entrar al admin con la cuenta del reviewer.
2. Entrar al simulador de busqueda.
3. Revisar el selector de municipio del simulador.
4. Buscar terminos que una persona normal buscaria.

La idea central del video: el reviewer no tiene que llenar todo perfecto. Su trabajo es mejorar la utilidad local de Vichente dentro de su zona.

## Notas para quien graba pantalla

- Grabar con una cuenta tipo `reviewer`, no admin.
- Mostrar solo negocios del municipio o zona asignada.
- No mostrar informacion sensible si hay datos reales que no deban verse.
- Negocios reales confirmados en prod para esta grabacion (Villa Union):
  - **Rama A (aparece incompleto):** `TACOS DE BARBACOA EL GABY` — categoria Taqueria, inactivo, tiene foto, sin offerings ni descripcion. Buscar `tacos de barbacoa` en el simulador.
  - **Rama B (no aparece / no existe):** buscar `pastel` en el simulador — cero resultados en **toda la base de datos** (no solo Villa Union), verificado el 2026-07-10. Ojo: el selector de municipio solo prioriza, no oculta, asi que un termino con resultados en OTRO municipio si aparecería aunque no lo elijas — por eso el termino de ejemplo debe dar cero en todas partes, no solo en tu zona.
- Si al momento de grabar Dani conoce un negocio real de pasteles en su zona, dar de alta con datos reales. Si no, **no guardar** el alta — mostrar el formulario lleno y explicar el flujo sin confirmar, para no dejar un negocio a medias en prod.
- **Ojo con `birria` como ejemplo:** ya existe `Birria El Caiman` en Villa Union (inactivo, categoria Antojitos, sin offerings) — si alguien busca "birria" SI va a salir un resultado (incompleto, en rojo). Sirve como ejemplo extra de Rama A, pero no como "no existe nada" para Rama B.
- No abrir secciones de admin-only como Categorias o Solicitudes si el tutorial es solo para reviewer.
- El selector de municipio del simulador no oculta otros municipios: solo prioriza los negocios del municipio elegido.
- En los resultados del simulador, la barra de color indica completitud: rojo = casi vacio, amarillo = a medias, verde = completo.
- En el simulador se puede dar click en un resultado para abrir la ficha del negocio y editarla directamente (sin pasar por Negocios).
- El slug es la URL publica del negocio. Se genera solo, pero se puede ajustar si hace falta.
- Al abrir el link publico en el browser, se muestra la landing/ficha que ve el usuario final y que se puede compartir con el dueno.

## Guion con timings

Cada fila es lo que se dice **mientras se hace la accion** — el texto ya nombra el click/campo, no hace falta leer notas aparte.

| Tiempo                                            | Guion (decir mientras se hace)                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00-0:20                                         | Para empezar, entramos al admin de Vichente con la cuenta asignada, escribiendo el correo y la contrasena. Cada colaborador debe usar su propia cuenta, porque el sistema limita lo que puede ver y editar segun su rol y su zona.                                                        |
| 0:20-0:40                                         | Ya adentro, vemos el dashboard y el menu lateral. En este tutorial vamos a ver el trabajo principal de un colaborador reviewer. La idea no es revisar todo el sistema, sino aprender el flujo para mejorar los negocios de tu zona.                                                       |
| 0:40-1:00                                         | Aqui en el menu vemos Negocios y Simulador de busqueda. Como reviewer, tu trabajo se concentra en estas dos partes: el simulador nos ayuda a pensar como usuario de la app, y Negocios nos permite corregir o dar de alta informacion.                                                    |
| 1:00-1:20                                         | Vamos a entrar primero al Simulador de busqueda, dando click aqui. Aqui probamos busquedas reales, como las haria una persona que quiere encontrar algo cerca. No buscamos solo nombres de negocios; buscamos cosas que la gente quiere comprar o encontrar.                              |
| 1:20-1:45                                         | Arriba tenemos un selector de municipio, y damos click para abrirlo. Este selector no elimina los negocios de otros municipios: lo que hace es darle prioridad a los negocios del municipio seleccionado, para que aparezcan primero, parecido a como lo veria un usuario de esa zona.    |
| 1:45-2:10                                         | Aqui vemos tambien una guia de colores. En los resultados, rojo significa que el negocio esta casi vacio o le falta mucha informacion, amarillo que esta a medias, y verde que la ficha esta bastante completa.                                                                           |
| 2:10-2:35                                         | Vamos a escribir "tacos de barbacoa" en el buscador. Aqui se pueden dar dos casos: que el negocio aparezca pero incompleto, o que no aparezca ningun negocio que sabemos que existe. Vamos a ver los dos.                                                                                 |
| **Rama A: el negocio aparece incompleto**         |                                                                                                                                                                                                                                                                                           |
| 2:35-3:00                                         | Vemos que aparece "Tacos de Barbacoa El Gaby" con la barra en rojo o amarillo. Eso quiere decir que el negocio ya esta en el sistema, pero le falta informacion.                                                                                                                          |
| 3:00-3:25                                         | Damos click directamente sobre este resultado. Eso abre su ficha para editarla, sin pasar por ningun otro lado.                                                                                                                                                                           |
| 3:25-3:55                                         | Aqui en la ficha revisamos la informacion basica: nombre, telefono, municipio, colonia, direccion, mapa, descripcion y foto si la tenemos. No siempre vamos a tener todo, y esta bien.                                                                                                    |
| 3:55-4:15                                         | Algo muy importante: vemos aqui el campo de municipio. Solo debemos trabajar negocios dentro de nuestra area de influencia. Cada colaborador se enfoca en su zona.                                                                                                                        |
| 4:15-4:45                                         | Bajamos a Categoria principal y Categorias adicionales. La categoria principal debe describir bien al negocio: como es una taqueria, la dejamos en una categoria relacionada con tacos o comida. Si tambien aplica a otras, la agregamos como categoria adicional.                        |
| 4:45-5:15                                         | Ahora en el campo de Oferta escribimos "tacos de barbacoa". Esta es una de las partes mas importantes: aqui ponemos productos o servicios concretos que la gente puede buscar.                                                                                                            |
| 5:15-5:45                                         | Agregamos otro offering mas: "consome", y otro: "barbacoa por kilo". Esto ayuda mucho porque muchas personas no buscan el nombre del negocio, buscan lo que quieren comprar.                                                                                                              |
| 5:45-6:10                                         | Bajamos a Aliases. Aqui agregamos nombres populares o formas en que la gente conoce al negocio, si tiene un nombre formal pero todos lo conocen por otro.                                                                                                                                 |
| 6:10-6:30                                         | Ahora activamos el negocio, dando click en el switch de activo. Si sabemos que existe y atiende al publico, lo dejamos activo. Si no estamos seguros, mejor lo dejamos inactivo hasta confirmar.                                                                                          |
| 6:30-6:50                                         | Tambien marcamos aqui Verificado, porque ya confirmamos la informacion hablando con el dueno o visitando el negocio. Esto le dice al usuario que los datos son confiables, no solo capturados de internet.                                                                                |
| 6:50-7:10                                         | Y si el negocio realmente sobresale en la zona, marcamos Recomendado o Destacado. Esto lo resalta dentro de la app — no se usa para cualquier negocio.                                                                                                                                    |
| 7:10-7:35                                         | Bajamos a la URL del negocio, el slug: aqui queda como vichente.com/tacos-de-barbacoa-el-gaby. Se genera solo a partir del nombre, pero se puede ajustar si hace falta que el link sea mas claro.                                                                                         |
| 7:35-8:00                                         | Damos click en Guardar. No tiene que quedar perfecto desde el primer dia; lo importante es que la ficha sea util y correcta con la informacion que tenemos.                                                                                                                               |
| 8:00-8:35                                         | Abrimos una pestana nueva con el link publico del negocio. Esta es la pagina que ve un usuario cuando entra al enlace, y tambien el link que se le puede mandar al dueno para que revise como aparece.                                                                                    |
| 8:35-9:00                                         | Aqui vemos las partes principales de la landing: nombre, categoria, y los datos disponibles. Si el dueno quiere agregar mas informacion, fotos u horarios, puede contactarnos — no pasa nada si al principio la ficha tiene informacion minima.                                           |
| 9:00-9:25                                         | Volvemos al Simulador de busqueda y escribimos otra vez "tacos de barbacoa". Esto nos confirma si el negocio ya aparece como esperamos.                                                                                                                                                   |
| 9:25-9:50                                         | Vemos que ahora el resultado cambio de color — ya no esta en rojo o amarillo. Este paso es clave: no basta con editar, siempre conviene validar la busqueda para saber que la informacion realmente le va a servir al usuario final.                                                      |
| **Rama B: el negocio no aparece en el simulador** |                                                                                                                                                                                                                                                                                           |
| 9:50-10:15                                        | Ahora busquemos "pastel" en el simulador. Vemos que no aparece nada. Cuando pasa esto, no hay nada que editar desde el simulador, porque no salio ningun resultado. Vamos entonces a la seccion de Negocios y buscamos "pastel" ahi tambien, antes de crear nada, para evitar duplicados. |
| 10:15-10:35                                       | Si aqui apareciera el negocio, es decir, existe pero no salia bien en el simulador, entraríamos a editarlo igual que hicimos antes: categoria, offerings, aliases y estado.                                                                                                               |
| 10:35-10:55                                       | Como confirmamos que de verdad no existe, damos click en Nuevo negocio.                                                                                                                                                                                                                   |
| 10:55-11:25                                       | Llenamos los campos minimos: nombre, categoria, telefono si lo tenemos, y municipio. No necesitamos tener toda la informacion — si conocemos al dueno o sabemos que el negocio existe, con esto basta para empezar.                                                                       |
| 11:25-11:50                                       | Revisamos aqui la URL que el sistema genero para el negocio. Conviene revisar que se vea bien, porque ese sera el link que podemos compartir con el dueno.                                                                                                                                |
| 11:50-12:10                                       | Volvemos al simulador y buscamos otra vez "pastel". Igual que en el primer caso, confirmamos que ahora el negocio aparece.                                                                                                                                                                |
| 12:10-12:30                                       | Recuerda: tu trabajo es mejorar la informacion local dentro de tu area. Cada categoria correcta, cada offering bien escrito, cada URL compartible y cada negocio activo hace que Vichente sea mas util para la gente.                                                                     |

## Guion corrido

Texto plano, listo para copiar y pegar directo a un LLM de voz / TTS. No tiene notas, corchetes ni marcado — es exactamente lo que se debe leer en voz alta, de principio a fin.

Para empezar, entramos al admin de Vichente con la cuenta asignada.

Cada colaborador debe usar su propia cuenta, porque el sistema limita lo que puede ver y editar segun su rol y su zona.

Ya adentro, vemos el dashboard y el menu lateral. En este tutorial vamos a ver el trabajo principal de un colaborador reviewer. La idea no es revisar todo el sistema, sino aprender el flujo para mejorar los negocios de tu zona.

Aqui en el menu vemos Negocios y Simulador de busqueda. Como reviewer, tu trabajo se concentra en estas dos partes: el simulador nos ayuda a pensar como usuario de la app, y Negocios nos permite corregir o dar de alta informacion.

Vamos a entrar primero al Simulador de busqueda. Aqui probamos busquedas reales, como las haria una persona que quiere encontrar algo cerca. No buscamos solo nombres de negocios; buscamos cosas que la gente quiere comprar o encontrar.

Arriba tenemos un selector de municipio. Este selector no elimina los negocios de otros municipios: lo que hace es darle prioridad a los negocios del municipio seleccionado, para que aparezcan primero, parecido a como lo veria un usuario de esa zona.

Aqui vemos tambien una guia de colores. En los resultados, rojo significa que el negocio esta casi vacio o le falta mucha informacion, amarillo que esta a medias, y verde que la ficha esta bastante completa.

Vamos a escribir "tacos de barbacoa" en el buscador. Aqui se pueden dar dos casos: que el negocio aparezca pero incompleto, o que no aparezca ningun negocio que sabemos que existe. Vamos a ver los dos.

Vemos que aparece "Tacos de Barbacoa El Gaby" con la barra en rojo o amarillo. Eso quiere decir que el negocio ya esta en el sistema, pero le falta informacion.

Damos click directamente sobre este resultado. Eso abre su ficha para editarla, sin pasar por ningun otro lado.

Aqui en la ficha revisamos la informacion basica: nombre, telefono, municipio, colonia, direccion, mapa, descripcion y foto si la tenemos. No siempre vamos a tener todo, y esta bien.

Algo muy importante: vemos aqui el campo de municipio. Solo debemos trabajar negocios dentro de nuestra area de influencia. Cada colaborador se enfoca en su zona.

Bajamos a Categoria principal y Categorias adicionales. La categoria principal debe describir bien al negocio: como es una taqueria, la dejamos en una categoria relacionada con tacos o comida. Si tambien aplica a otras, la agregamos como categoria adicional.

Ahora en el campo de Oferta escribimos "tacos de barbacoa". Esta es una de las partes mas importantes: aqui ponemos productos o servicios concretos que la gente puede buscar.

Agregamos otro offering mas: "consome", y otro: "barbacoa por kilo". Esto ayuda mucho porque muchas personas no buscan el nombre del negocio, buscan lo que quieren comprar.

Bajamos a Aliases. Aqui agregamos nombres populares o formas en que la gente conoce al negocio, si tiene un nombre formal pero todos lo conocen por otro.

Ahora activamos el negocio. Si sabemos que existe y atiende al publico, lo dejamos activo. Si no estamos seguros, mejor lo dejamos inactivo hasta confirmar.

Tambien marcamos aqui Verificado, porque ya confirmamos la informacion hablando con el dueno o visitando el negocio. Esto le dice al usuario que los datos son confiables, no solo capturados de internet.

Y si el negocio realmente sobresale en la zona, marcamos Recomendado o Destacado. Esto lo resalta dentro de la app, no se usa para cualquier negocio.

Bajamos a la URL del negocio, el slug: aqui queda como vichente punto com, tacos de barbacoa el gaby. Se genera solo a partir del nombre, pero se puede ajustar si hace falta que el link sea mas claro.

Damos click en Guardar. No tiene que quedar perfecto desde el primer dia; lo importante es que la ficha sea util y correcta con la informacion que tenemos.

Abrimos una pestana nueva con el link publico del negocio. Esta es la pagina que ve un usuario cuando entra al enlace, y tambien el link que se le puede mandar al dueno para que revise como aparece.

Aqui vemos las partes principales de la landing: nombre, categoria, y los datos disponibles. Si el dueno quiere agregar mas informacion, fotos u horarios, puede contactarnos, no pasa nada si al principio la ficha tiene informacion minima.

Volvemos al Simulador de busqueda y escribimos otra vez "tacos de barbacoa". Esto nos confirma si el negocio ya aparece como esperamos.

Vemos que ahora el resultado cambio de color, ya no esta en rojo o amarillo. Este paso es clave: no basta con editar, siempre conviene validar la busqueda para saber que la informacion realmente le va a servir al usuario final.

Ahora veamos el otro caso: buscamos algo y no aparece ningun negocio que sabemos que existe. Busquemos "pastel" en el simulador. Vemos que no aparece nada.

Cuando pasa esto, no hay nada que editar desde el simulador, porque no salio ningun resultado.

Vamos entonces a la seccion de Negocios y buscamos "pastel" ahi tambien, antes de crear nada, para evitar duplicados.

Si aqui apareciera el negocio, es decir, existe pero no salia bien en el simulador, entrariamos a editarlo igual que hicimos antes: categoria, offerings, aliases y estado.

Como confirmamos que de verdad no existe, damos click en Nuevo negocio.

Llenamos los campos minimos: nombre, categoria, telefono si lo tenemos, y municipio. No necesitamos tener toda la informacion; si conocemos al dueno o sabemos que el negocio existe, con esto basta para empezar.

Revisamos aqui la URL que el sistema genero para el negocio. Conviene revisar que se vea bien, porque ese sera el link que podemos compartir con el dueno.

Volvemos al simulador y buscamos otra vez "pastel". Igual que en el primer caso, confirmamos que ahora el negocio aparece.

Recuerda: tu trabajo es mejorar la informacion local dentro de tu area. Cada categoria correcta, cada offering bien escrito, cada URL compartible y cada negocio activo hace que Vichente sea mas util para la gente.

## Checklist para reviewer

- Buscar terminos reales en el simulador.
- Elegir el municipio en el simulador para priorizar resultados de esa zona.
- Usar los colores del simulador para detectar fichas incompletas.
- **Si el negocio aparece incompleto:** dar click en el resultado del simulador y editarlo directamente.
- **Si el negocio no aparece:** ir a Negocios y buscarlo ahi antes de crear nada, para evitar duplicados.
- Si existe en Negocios pero no salia en el simulador, corregirlo (categoria, offerings, aliases, estado).
- Si de verdad no existe, darlo de alta con Nuevo negocio e informacion minima.
- Corregir categoria principal y agregar categorias adicionales cuando aplique.
- Agregar offerings concretos: productos y servicios que la gente buscaria.
- Agregar aliases si el negocio tiene nombres populares.
- Activar solo negocios que sabemos que existen y atienden al publico.
- Marcar Verificado solo si ya confirmaste la info con el dueno o en sitio.
- Marcar Recomendado/Destacado solo si el negocio realmente sobresale en tu zona.
- Revisar que el slug o URL publica sea claro.
- Abrir el link publico para ver la landing que vera el usuario, y compartirla con el dueno cuando aplique.
- Validar otra vez en el simulador despues de cualquier cambio o alta.

## Ejemplos de busquedas utiles

Usados en la grabacion de Villa Union (verificados en prod):

- `tacos de barbacoa` → Rama A, negocio real: `TACOS DE BARBACOA EL GABY`.
- `pastel` → Rama B, cero resultados en toda la base (no solo Villa Union).

Otros terminos naturales por si se necesitan mas ejemplos en vivo:

- hamburguesas (real: `Hamburguesas primo`)
- pollos asados
- birria (real: `Birria El Caiman`, inactivo — sirve como Rama A alterno, NO como Rama B)
- cafe
- pan
- barberia (real: `Ray's Hood Barber`, `Salon...Barberia PRISCILA DE LEON`)
- corte de cabello
- unas
- mecanico (real: varios `Taller Mecanico ...`)
- ferreteria (real: `FERRETERÍA NUNEZ`, `punto ferretero`)
- farmacia

## Criterio editorial

Usar lenguaje simple y operativo. El reviewer no necesita entender detalles tecnicos del sistema. Lo que debe recordar es:

- Buscar como usuario.
- Trabajar solo su zona.
- Evitar duplicados.
- Mejorar categorias y offerings.
- Activar negocios reales.
- Validar en el simulador.
