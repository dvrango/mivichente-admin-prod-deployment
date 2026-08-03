-- Vocabulario de búsqueda: aliases morfológicos + catálogo faltante.
--
-- Origen: misses reales en `search_events` (result_count = 0) de usuarios ajenos.
-- `musicos` -> 0 mientras `musica` -> 9. `takitos` -> 0 mientras `taqueria` -> 15.
--
-- Diagnóstico: los aliases existentes cubrían sinónimos regionales creativos
-- (`sierreños`, `tamborazos`, `chirrines`) pero se saltaron las variantes
-- morfológicas de la propia palabra (plural, sustantivo -> agente). Además 30 de
-- 68 categorías no tenían ningún alias.
--
-- REGLA AL ESCRIBIR ALIASES (el match es bidireccional):
--   business_matches_term() evalúa
--     unaccent(lower(alias)) ilike '%term%'      -- el term es substring del alias
--     OR term ilike '%' || unaccent(lower(alias)) || '%'  -- el alias es substring del term
--   La segunda mitad es la trampa: un alias corto se dispara dentro de palabras
--   más largas y no relacionadas. `obra` se dispararía con "obrador", `bar` con
--   "barbacoa", `pan` con "pañales", `torno` con "entorno", `ropa` con "europa".
--   Por eso aquí:
--     1. Se prefiere la forma PLURAL/larga. El singular queda cubierto solo por
--        la primera mitad ('musicos' ilike '%musico%' = true), así que agregar
--        el plural cubre ambas sin agregar riesgo.
--     2. Nada por debajo de 5 caracteres salvo que sea inequívoco. Los aliases
--        de menos de 3 se ignoran en silencio (length(ca) >= 3).
--     3. Se descartaron por substring peligroso: `obra` (obrador), `taxi`
--        (taxidermia), `res` (restaurante), `misa` (camisa), `culto` (oculto),
--        `aseo` (paseo), `masa` (masajes), `pasto` (pastor), `rejas` (orejas),
--        `ramos` (tramos), `rutas` (frutas), `spa` (espacio), `gas` (gasolina),
--        `moda` (acomoda), `asado` (atrasado).
--
-- CUÁNDO **NO** ESCRIBIR UN ALIAS (revisión 2026-07-30, medida contra prod).
-- La primera versión traía 463 aliases; se recortó a 365 porque cuatro clases
-- no aportaban un solo resultado:
--
--   a) Categoría con CERO negocios activos. Un alias no puede devolver lo que no
--      existe. Se eliminaron los bloques de Panadería, Pastelería, Pollo,
--      Comida Oriental, Hot dogs, Gasolinera, Jugos / Licuados y Jardineria (46
--      aliases). Ojo: en varias de ellas el negocio SÍ existe pero está mal
--      categorizado — "hot dogs" y "hamburguesas" aparecen como offerings de
--      EcoMercado y El Túnel, ambos en Comida Mexicana. Eso se arregla
--      reclasificando, no con vocabulario.
--
--   b) El alias está contenido en el NOMBRE de su propia categoría. La rama
--      `c.name ilike '%term%'` ya lo cubre. Se quitaron `dentista`,
--      `restaurant`, `carnitas`, `postre`, `reparacion`, `ancianos`, `eventos`,
--      `nieves`, `pintores`, `rotulistas`, `pescado crudo`.
--
--   c) `word_similarity` contra el nombre del negocio ya cubre el plural. Si el
--      negocio se llama "Carnicería Calilo's", el término `carnicerias` ya lo
--      encontraba. Medido antes de esta migración: carnicerias 3 de 3,
--      lavanderias 2 de 2, barberias 4 de 3, pizzas 8 de 7, tortillerias 1 de 1,
--      vulcanizadoras 1 de 1, taxis 6 (con 1 solo negocio en la categoría).
--      Distinto es Musica o Servicios Públicos, donde el negocio NO lleva el
--      giro en el nombre ("Banda La Colmena", "DIF Municipal"): ahí el alias
--      pasa de 0 a 9 y a 7 resultados. Esos se quedan.
--
--   d) Ya lo cubre un `offering` y la categoría tiene 1 solo negocio. La rama de
--      offerings matchea `term ilike '%offering%'`, así que `gelish`, `dieta` o
--      `meal prep` ya funcionaban sin alias — y funcionan MEJOR, porque
--      devuelven el negocio que lo ofrece y no la categoría entera. Por eso se
--      borraron Comida Saludable y Nutriologo completos (15 aliases) y no se
--      agregaron los ~65 offerings huérfanos (`tortas`, `molletes`, `plomeria`,
--      `tablaroca`, `fade`…): como alias de categoría empeorarían el resultado.
--      Donde la categoría tiene varios negocios el alias SÍ suma, porque solo 31
--      de 368 negocios tienen offerings capturados.
--
-- También se quitaron dos aliases que devolvían la categoría equivocada:
--   * `limpieza dental` en Dentistas hacía que buscar "limpieza" trajera las 12
--     dentistas encima del único negocio de Limpieza.
--   * `salon de belleza` en Belleza sepultaba los 4 Salón de Eventos bajo 16
--     estéticas al buscar "salon".
--   * `taxis` en Transporte devolvía autobuses, mudanzas y fletes a quien pide
--     un taxi.
--
-- Nota sin resolver: la rama de offerings NO tiene guard de longitud ni la
-- dirección inversa, así que se salta la regla de "nada por debajo de 5
-- caracteres". Hoy en prod `antro` devuelve 8 resultados: 7 bares y Sofi Barrios
-- Nutrióloga, por el offering `antropometria`. No lo causa esta migración.
--
-- Los arrays se escriben COMPLETOS (no se hace array_append) para que la
-- migración sea idempotente y el estado final quede legible en un solo lugar.

-- ---------------------------------------------------------------------------
-- 1. Categorías que YA tenían aliases: se agregan variantes morfológicas.
-- ---------------------------------------------------------------------------

-- El miss que originó la tarea: `musicos` no estaba. Ninguna banda lleva
-- "música" en el nombre, así que aquí el alias es lo único que las encuentra.
update public.categories set aliases = array[
  'bandas','grupos','sierreños','norteños','tamborazos','mariachi','chirrines',
  'produccion musical','estudio','grabacion',
  'musicos','conjuntos','sonideros','cantantes','sonido para fiestas','bocinas'
] where name = 'Musica';

-- `takitos` devolvía 0 (escritura fonética real de un usuario).
update public.categories set aliases = array[
  'tacos','taquitos','dorados',
  'takitos','takos','taquerias','taqueros'
] where name = 'Taqueria';

update public.categories set aliases = array[
  'wings','boneless','bonles','alitas bbq'
] where name = 'Alitas';

update public.categories set aliases = array[
  'tamales','atole','atoles','antojos','champurrado','antojitos mexicanos'
] where name = 'Antojitos';

-- Ojo: `cerveza` vive aquí. Por eso buscar "cerveza" devuelve bares y no
-- depósitos. NO se agrega `deposito` a Bares: devolver bares a quien busca un
-- depósito cambia el cero por una lista equivocada. Ver el bloque de Depósito.
update public.categories set aliases = array[
  'cerveza','cervezas','micheladas','chelas','cheve','cantina','cantinas',
  'pisto','modelorama','antro','antros'
] where name = 'Bares';

-- Fix: el alias era `Ropa`, que se disparaba dentro de "euROPA". `ropas` cubre
-- el singular por la primera mitad del match y no es substring de "europa".
update public.categories set aliases = array[
  'ropas','boutiques','vestidos','ropa de dama','tienda de ropa'
] where name = 'Boutique';

update public.categories set aliases = array[
  -- `cafe` a secas se quitó: se disparaba dentro de "cafetera". El término
  -- "cafe" sigue matcheando por el NOMBRE de la categoría ("Cafetería").
  -- `frappes` se quitó: es offering de El Túnel, el único negocio de la
  -- categoría, así que ya matcheaba.
  'cafes','cafeterias','capuchino','expresso'
] where name = 'Cafetería';

update public.categories set aliases = array[
  'autolavado','autolavados','carwash','lavado de autos','lavado de carros'
] where name = 'Car Wash';

-- `carnitas` se quitó: está en el nombre de la categoría y además es offering.
update public.categories set aliases = array[
  'chicharrones','chicharron de puerco','maciza'
] where name = 'Carnitas';

-- `comida casera` se quitó: es offering del único negocio de la categoría.
update public.categories set aliases = array[
  'fonda','fondas','comida corrida','comidas corridas',
  'cocinas economicas','guisados','menu del dia'
] where name = 'Cocina Economica';

-- 40 negocios y solo unos pocos con offerings, así que `barbacoa`, `consome` y
-- `burritos` sí suman aunque también existan como offering.
update public.categories set aliases = array[
  'birria','birrieria','barbacoa','barbacoas','consome','menudo','burritos',
  'pozole','chilaquiles','quesadillas','discada','gorditas de guisado'
] where name = 'Comida Mexicana';

-- `escuelas` se quitó: el alias `escuela` ya existía y lo cubre por la
-- dirección inversa del match.
update public.categories set aliases = array[
  'escuela','secundaria','universidad','bachillerato','primaria',
  'kinder','preescolar','maestros','clases','cursos','regularizacion'
] where name = 'Educación';

update public.categories set aliases = array[
  'floristeria','florerias','flores','arreglos florales','ramos de flores',
  'coronas funebres'
] where name = 'Floreria';

update public.categories set aliases = array[
  'fotografos','fotografas','estudio de fotografía','fotos','sesion de fotos',
  'sesion fotografica'
] where name = 'Fotografía';

update public.categories set aliases = array[
  'gordas','gorditas de harina','gorditas de maiz'
] where name = 'Gorditas';

-- Fix: el alias era `Torno`, que se disparaba dentro de "enTORNO", "reTORNO" y
-- "conTORNO". `tornos` cubre el singular y no es substring de esas palabras.
update public.categories set aliases = array[
  'tornos','herrerias','herreros','soldadura','soldador','portones',
  'barandales','estructuras metalicas'
] where name = 'Herrería';

-- `clinicas` se quitó: el alias `clinica` ya existía y lo cubre.
update public.categories set aliases = array[
  'clinica','hospitales','urgencias','sanatorio'
] where name = 'Hospital';

-- `lavanderias` se quitó: los dos negocios se llaman "Lavandería …", el plural
-- ya los encontraba por word_similarity.
update public.categories set aliases = array[
  'lava ropa','lavado de ropa','planchado','tintorerias'
] where name = 'Lavanderia';

-- Fix estructural: los tres aliases estaban en UN SOLO elemento del array
-- ('ceviche, aguachile, camarones'). Funcionaba de chiripa por el substring,
-- pero cualquier lógica futura que itere el array lo habría leído mal.
update public.categories set aliases = array[
  'ceviche','ceviches','aguachile','camarones','coctel de camaron',
  'pescado frito','tostadas de ceviche'
] where name = 'Mariscos';

-- `doctores` se quitó: el alias `doctor` ya existía y lo cubre.
update public.categories set aliases = array[
  'doctor','medicos','enfermero','enfermeras','cirujano','hospital',
  'consultorios','pediatras','ginecologos','consulta general'
] where name = 'Medico';

-- `nieves` se quitó: está en el nombre de la categoría.
update public.categories set aliases = array[
  'paletas','helados','raspados','paleterias'
] where name = 'Paletería / Nieves';

-- `pintores` y `rotulistas` están en el nombre de la categoría; `pintura` y
-- `rotulos` son offerings del único negocio. Queda solo lo que agrega.
update public.categories set aliases = array[
  'pinta casas','pintar casa','lonas'
] where name = 'Pintores y Rotulistas';

-- Fix: `cena` se disparaba dentro de "doCENA", "esCENA" y "azuCENA". `cenas`
-- cubre el singular y `cenaduria` queda explícito. `restaurant` se quitó: está
-- en el nombre de la categoría.
update public.categories set aliases = array[
  -- `comer` a secas NO: se dispara dentro de "comercio".
  'almuerzos','desayuno','desayunos','cenas','cenaduria',
  'donde comer','lugares para comer'
] where name = 'Restaurantes';

update public.categories set aliases = array[
  'fincas','salones','salon de fiestas','quintas','terrazas',
  'jardin de eventos'
] where name = 'Salón de Eventos';

update public.categories set aliases = array[
  'elotes','esquites','tostilocos','dorilocos','botanas','frituras','chetos',
  'papas preparadas'
] where name = 'Snacks';

update public.categories set aliases = array[
  'servicio automotriz','automotriz','mecanicos','talleres','hojalateria',
  'afinacion','frenos','suspension','cambio de aceite'
] where name = 'Taller Mecanico';

update public.categories set aliases = array[
  'tattoo','tatuadores','tatuadora','perforaciones','piercings'
] where name = 'Tatuajes';

-- `hoteles` se quitó: el alias `hotel` ya existía y lo cubre.
update public.categories set aliases = array[
  'hotel','airbnb','experiencias','hospedaje','alojamiento','posada',
  'motel','cabañas'
] where name = 'Turismo';

update public.categories set aliases = array[
  'nails','nail artist','manicurista','manicuristas','manicure','pedicure',
  'acrilicas','gelish'
] where name = 'Uñas';

update public.categories set aliases = array[
  'jafra','tupperware','avon','marikey','merikey','betterware','fuller',
  'catalogos','price shoes'
] where name = 'Venta por Catalogo';

-- ---------------------------------------------------------------------------
-- 2. Categorías que NO tenían ningún alias.
--    Se priorizaron las que ya registran tráfico observado en search_events.
-- ---------------------------------------------------------------------------

-- 28 negocios activos y es la query que escribió el visitante del post de
-- Aldaco. Los aliases salen de lo que REALMENTE hay adentro: ferreterías,
-- madererías, materiales, aceros, vidrios/aluminios, concretera, eléctrico.
-- NO se agrega `obra`: se dispararía dentro de "obrador".
-- Medido: `construcciones` pasa de 2 a 28 resultados, `ferreterias` de 4 a 28.
update public.categories set aliases = array[
  'construcciones','constructoras','albañiles','arquitectos',
  'materiales para construccion','materiales','ferreterias','madererias',
  'maderas','aceros','varilla','cemento','concreto','vidrios','aluminio',
  'canceles','material electrico'
] where name = 'Construccion';

-- `carnicerias` se quitó: los 3 negocios se llaman "Carnicería …".
update public.categories set aliases = array[
  'carnes','carniceros','carne de res','carne molida','bistec'
] where name = 'Carnicería';

update public.categories set aliases = array[
  'psicologos','psicologa','psicologia','terapias','terapeuta','salud mental'
] where name = 'Psicologo';

-- `taxis` se quitó: ya devolvía 6 negocios por nombre ("Taxi Don Beto") y la
-- categoría tiene 1 solo.
-- `taxi` a secas tampoco, porque se dispararía con "taxidermia".
update public.categories set aliases = array[
  'taxistas','sitio de taxis','radiotaxi'
] where name = 'Taxi';

-- `mandados` se quitó: ya daba 9 resultados por nombre y por offering.
update public.categories set aliases = array[
  'mandaderos','encargos','recados','diligencias','entregas',
  'a domicilio','motomandado'
] where name = 'Mandaditos';

-- Adentro hay taxis, autobuses y foráneos, no solo "transporte".
update public.categories set aliases = array[
  -- `corridas` a secas NO: se dispara dentro de "comidas corridas"
  -- (Cocina Economica) y devolvería 12 transportistas a quien busca comida.
  -- `taxis` NO: devolvería autobuses, mudanzas y fletes a quien pide un taxi.
  'transportes','autobuses','camiones','mudanzas','fletes','acarreos',
  'corridas de autobus','viajes foraneos'
] where name = 'Transporte';

-- `vulcanizadoras` se quitó: `vulcanizadora` ya lo cubre por substring.
update public.categories set aliases = array[
  'desponchadoras','vulcanizadora','llantas','llanteras',
  'ponchaduras','parche de llanta'
] where name = 'Desponchadora';

-- `pizzas` se quitó: ya daba 8 resultados por nombre. `pizzerias` daba 0.
update public.categories set aliases = array[
  'pizzerias','pizza familiar'
] where name = 'Pizzeria';

update public.categories set aliases = array[
  'burgers','hamburguesa doble','papas a la francesa'
] where name = 'Hamburguesas';

-- `barberias` se quitó: ya daba 4 resultados por nombre, con 3 negocios.
update public.categories set aliases = array[
  'barberos','peluquerias','corte de pelo','corte de cabello','rasurada'
] where name = 'Barberia';

-- `salon de belleza` se quitó: hacía que buscar "salon" sepultara los 4 Salón
-- de Eventos bajo estas 16 estéticas.
update public.categories set aliases = array[
  'esteticas','maquillaje','depilacion','pestañas',
  'cejas y pestañas','cosmetologa','peinados'
] where name = 'Belleza';

update public.categories set aliases = array[
  'carpinteros','carpinterias','muebles','madera a la medida','closets',
  'cocinas integrales'
] where name = 'Carpintero';

update public.categories set aliases = array[
  'internet','telecomunicaciones','telecom','antenas','cable','television',
  'wifi','recargas'
] where name = 'Comunicaciones';

-- `dentista` se quitó: está en el nombre de la categoría (ya daba 12 de 12).
-- `limpieza dental` se quitó: hacía que buscar "limpieza" trajera las 12
-- dentistas encima del único negocio de la categoría Limpieza.
update public.categories set aliases = array[
  'odontologos','dentales','muelas','ortodoncia','brackets'
] where name = 'Dentistas';

update public.categories set aliases = array[
  'distribuidoras','proveedores','mayoreo','agua purificada','garrafones'
] where name = 'Distribuidores';

-- `eventos` se quitó: está en el nombre de esta categoría y en el de Salón de
-- Eventos, así que el nombre ya lo resolvía.
update public.categories set aliases = array[
  'banquetes','mesas y sillas','brincolines','piñatas','botargas',
  'animacion','mobiliario para fiestas'
] where name = 'Fiestas y Eventos';

update public.categories set aliases = array[
  'gimnasios','gym','ejercicio','pesas','crossfit','zumba','entrenador'
] where name = 'Fitness';

update public.categories set aliases = array[
  'gaseras','gas lp','tanque de gas','cilindros de gas','recarga de gas'
] where name = 'Gasera';

update public.categories set aliases = array[
  'iglesias','templos','parroquias','religion','capilla'
] where name = 'Iglesia';

update public.categories set aliases = array[
  'limpiezas','servicio de limpieza','intendencia','afanadora',
  'limpieza de casas'
] where name = 'Limpieza';

update public.categories set aliases = array[
  'paqueterias','mensajeria','mensajerias','envios','paquetes','estafeta',
  'fedex','recoleccion de paquetes'
] where name = 'Paqueteria';

-- `pescado crudo` se quitó: está en el nombre de la categoría.
update public.categories set aliases = array[
  'pescados','filete de pescado','camaron crudo','mariscos crudos'
] where name = 'Pescaderia (pescado crudo)';

-- `postre` se quitó: está en el nombre de la categoría.
update public.categories set aliases = array[
  'gelatinas','flanes','cheesecake','fresas con crema','dulces'
] where name = 'Postres';

-- `reparacion` se quitó: está en el nombre de la categoría.
update public.categories set aliases = array[
  -- `arreglos` a secas NO: se dispara dentro de "arreglos florales" (Floreria).
  'reparar','composturas','tecnicos','reparacion de electrodomesticos'
] where name = 'Reparaciones';

-- Ningún negocio lleva "servicio público" en el nombre (DIF, CFE, Bomberos),
-- así que aquí el alias es lo único que los encuentra: `gobierno` pasa de 0 a 7.
update public.categories set aliases = array[
  'gobierno','presidencia municipal','ayuntamiento','policia','bomberos',
  'registro civil','oficinas de gobierno','tramites'
] where name = 'Servicios Públicos';

-- `tortillerias` se quitó: el único negocio se llama "Tortillería Los Cuates".
update public.categories set aliases = array[
  'tortillas','tortillas de maiz','nixtamal','masa para tortilla'
] where name = 'Tortillería';

-- `ancianos` se quitó: está en el nombre de la categoría.
update public.categories set aliases = array[
  'asilos','adultos mayores','casa de reposo','abuelitos'
] where name = 'Asilo de ancianos';

-- ---------------------------------------------------------------------------
-- 2b. Desactivar minas en categorías vacías.
-- ---------------------------------------------------------------------------
-- Estas dos categorías no reciben vocabulario nuevo (0 negocios activos), pero
-- arrastran de prod un alias con substring peligroso. Hoy son inertes —el
-- exists() no encuentra negocios, así que "pañales" y "desarrollos" devuelven 0—
-- pero se reactivan solas en cuanto alguien categorice una panadería o un
-- oriental, que es justo el siguiente paso recomendado. Se limpian ahora.
update public.categories set aliases = array['bolillo']  -- se quita `pan` ("PAÑales", "emPANadas")
  where name = 'Panadería';
update public.categories set aliases = array['sushi']    -- se quita `rollos` ("desaRROLLOS")
  where name = 'Comida Oriental';

-- `General` se queda SIN aliases a propósito: es el cajón de sastre (22
-- negocios activos sin giro claro). Cualquier alias aquí devolvería ruido para
-- una intención específica.

-- ---------------------------------------------------------------------------
-- 3. `deposito`: se crea la categoría, pero el miss NO se cierra aquí.
-- ---------------------------------------------------------------------------
-- Un usuario tecleó dep -> depo -> depos -> deposi -> deposito -> depósito,
-- todo en cero, se rindió y escribió "cerveza". Eso NO es un problema de
-- vocabulario, son tres cosas apiladas:
--   * No existía categoría de depósito (cerveza para llevar) entre las 68.
--   * "Six Carranza" —que es un depósito— está clasificado como Bar, y además
--     está duplicado: dos filas, 46a809f2 (activa, alta 2026-05-26) y
--     24c4da29 (inactiva, alta 2026-07-07).
--   * "La Taberna del Minero Modelorama" (dc4ca8d2) está inactivo.
--   * En el pueblo hay varios depósitos; en el directorio hay uno solo activo.
--
-- Agregar `deposito` como alias de Bares habría cambiado el cero por una lista
-- EQUIVOCADA: los 8 resultados de "cerveza" hoy son bares y restaurantes, no
-- lugares para llevar. La categoría se crea VACÍA y SIN ALIASES: mientras no
-- tenga negocios, un alias no puede devolver nada (misma razón por la que se
-- borraron los bloques de Panadería, Pollo y compañía). Los aliases se agregan
-- cuando haya catálogo. Cerrar el miss de verdad requiere, en el admin:
--   1. reclasificar Six Carranza (activa) de Bares a Depósito y borrar el
--      duplicado inactivo,
--   2. decidir si La Taberna del Minero Modelorama se reactiva,
--   3. cobertura de campo: dar de alta los depósitos que faltan.
-- Nada de eso es una migración.
insert into public.categories (name, icon, type)
select 'Depósito', '🍻', 'business'
where not exists (select 1 from public.categories where name = 'Depósito');
