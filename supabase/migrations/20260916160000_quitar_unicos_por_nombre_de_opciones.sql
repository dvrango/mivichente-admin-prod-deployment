-- Quita los dos índices únicos por nombre que creó 20260916120000, uno en los
-- grupos de opciones y otro en las opciones. La regla no desaparece: se muda al
-- formulario del editor de menú (`sqknppnyb`).
--
-- Por qué se mueve. Un nombre duplicado es un error de captura, no un agujero:
-- nadie ve datos ajenos y nadie cobra de menos. A cambio, el índice hace fallar
-- un guardado legítimo. El caso concreto es intercambiar los nombres de dos
-- grupos del mismo platillo en un solo guardado —"Leche" pasa a "Sabor" y
-- "Sabor" a "Leche"—: el editor actualiza fila por fila, así que pasa por un
-- estado intermedio con dos grupos llamados igual y la base lo rechaza a media
-- escritura. Quien recibe ese error es Sandra, que captura menús y no tiene
-- cómo entender qué pasó.
--
-- Dónde vive ahora la regla: el Zod del editor rechaza dos grupos con el mismo
-- nombre en un platillo, y dos opciones con el mismo nombre en un grupo,
-- comparando sin distinguir mayúsculas ni espacios de sobra —igual que hacía el
-- índice— y diciendo CUÁL está repetido, que es lo que un índice único nunca
-- pudo decir.
--
-- Lo que NO se quita: los índices por (service_id, order_index) y
-- (group_id, order_index). Esos son de lectura, no de integridad, y los usa
-- cada vez que se pinta un platillo.
--
-- Tampoco se toca el trigger `business_service_option_groups_reject_size`: ese
-- sí protege algo real —que el mismo platillo no tenga el tamaño capturado en
-- dos tablas a la vez— y no hay forma de que dispare en un guardado legítimo.

drop index if exists public.business_service_option_groups_name_uniq;
drop index if exists public.business_service_options_name_uniq;
