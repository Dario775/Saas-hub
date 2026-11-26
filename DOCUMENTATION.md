# Arquitectura y operación

## Organización

`src/app/page.tsx` compone el espacio desde `src/features/workspace/Workspace.tsx`. La navegación, el controlador y los borradores están en `hooks/`; las pantallas independientes, en `views/`. Las vistas pesadas se cargan cuando se necesitan.

El controlador conserva la coordinación de los flujos existentes. La división permite seguir extrayendo integraciones sin mezclar sus cambios con la estructura visual. Quedan tipos amplios y efectos heredados en estas integraciones; ESLint los señala como avisos. La infraestructura nueva mantiene reglas de tipado estrictas.

`workspace.css` define barra lateral, jerarquía de textos, colores, paneles, carga y adaptación móvil. La navegación conserva marca y vista en la URL y responde a atrás/adelante.

## Persistencia

| Archivo o almacén | Contenido |
| --- | --- |
| `.env.local` | Configuración privada del servidor |
| `custom-pages.json` | Páginas añadidas y sus credenciales; exclusivamente servidor |
| `brands.json` | Identidad y preferencias de marcas |
| `scheduled-posts.json` | Publicaciones, fechas, estados y referencias remotas |
| `leads/data/leads.json` | Prospectos y progreso comercial |
| `leads/data/leads.csv` | Exportación de compatibilidad |
| `leads-crm.json` | Espejo de datos comerciales heredado |
| `campaign-config.json` | Configuración comercial |
| `public/scheduled-images`, `public/generated-videos` | Recursos de publicaciones |
| IndexedDB `saashub-designs` | Diseños por marca, en cada navegador |
| localStorage `saashub-publish-drafts` | Textos de publicaciones por marca |

Conservá juntos los datos y sus archivos multimedia al hacer una copia de seguridad. Los borradores del navegador no se incluyen en una copia del servidor; exportá los diseños que necesites conservar fuera de ese navegador. Los archivos multimedia de `public` se sirven como recursos públicos.

La copia previa de la refactorización está en `.refactor-backup/2026-09-10`. Contiene archivos anteriores del proyecto y puede incluir configuración sensible. Está excluida de Git y debe conservarse de forma privada.

`json-store.ts` escribe mediante reemplazo atómico y proporciona bloqueos entre procesos. Un JSON corrupto produce un error; no se reemplaza silenciosamente por una lista vacía. La agenda usa el bloqueo para cada cambio de estado. La búsqueda comercial vuelve a leer los prospectos al terminar solicitudes externas para conservar cambios realizados durante la espera.

## Flyers

`src/lib/flyers` crea cuatro propuestas por pedido. Claude dirige y elige entre diez sistemas de diseño (`templates*.ts`); ComfyUI genera la foto u objeto solo si el sistema lo pide; Chrome o Edge en modo oculto convierte el HTML en PNG de 2160 px (`CHROME_PATH` permite indicar otro navegador); Claude revisa la imagen y corrige hasta dos veces. Los textos se validan y se escapan antes de dibujar. Corre un trabajo por vez. Los datos quedan en `flyers-data/`, fuera de Git. "Editar en el editor de diseño" vuelve a dibujar el flyer en dos modos (`export-script.ts`): uno mide cada texto (posición, fuente, color, cortes de línea y opacidad) y otro genera el fondo sin esos textos; el editor los recibe como capas. Lo marcado con `data-static` en un diseño queda en el fondo.

## Publicaciones

Los endpoints comparten validación y `social-dispatcher.ts`. El motor nativo admite publicación directa y programada en Facebook, Instagram (Business/Reels), LinkedIn y X (Twitter). n8n ha sido completamente desvinculado del sistema.

El programador arranca desde `src/instrumentation.ts`, en el servidor Node y fuera de la compilación. Cada 30 segundos reclama publicaciones pendientes antes de realizar solicitudes externas. Un segundo proceso no puede reclamar al mismo tiempo la misma publicación.

Estados: `pending`, `publishing`, `scheduled`, `published`, `failed`. `scheduled` con `fbScheduled` significa que Facebook aceptó una programación nativa. El worker consulta el resultado después de la fecha; un error de consulta nunca provoca otro envío.

Si un envío queda sin resultado confirmado o un proceso muere, se requiere revisión manual. No se garantiza entrega exactamente una vez ante una caída de red: el proveedor puede haber aceptado un envío sin que su respuesta llegue. Antes de reintentar un caso incierto, comprobá Facebook.

Cancelar una programación nativa primero solicita su cancelación remota. El antiguo `scripts/facebook-native.mjs` fue retirado porque escribía fuera de estos controles y su modo de prueba generaba publicaciones reales.

## Conexiones y acceso

- `/api/pages` devuelve metadatos públicos y el indicador `connected`.
- `/api/settings` informa si hay claves configuradas, sin devolverlas. Los campos vacíos conservan las claves existentes.
- `env-store.ts` serializa las escrituras de configuración y rechaza saltos de línea en valores.
- Las claves heredadas del navegador se migran sin reemplazar credenciales ya configuradas.
- `HUB_PASSWORD` habilita un acceso de administrador con cookie HttpOnly, SameSite estricto, firma y vencimiento de 12 horas. Cambiar la contraseña invalida sesiones anteriores. No es un sistema de usuarios ni de permisos por marca.
- El proxy comprueba el origen de las solicitudes de modificación. `PUBLIC_APP_URL` debe coincidir con el origen visible del panel si se usa un proxy externo.
- `/demo/*` contiene propuestas públicas sin indexación. Una referencia inexistente devuelve 404; no se inventan reseñas ni horarios.
- La extracción de sitios y descarga de exportaciones valida destinos públicos, fija la IP tras resolver DNS, limita tamaño y tiempo y revisa redirecciones.
- Los servicios locales de IA siguen siendo configurables por el administrador y requieren instalaciones externas.

Canva exporta mediante su trabajo de exportación PNG, espera la finalización e importa la imagen resultante. Referencias: [crear exportación](https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/) y [consultar exportación](https://www.canva.dev/docs/connect/api-reference/exports/get-design-export-job/).

## Validación

Las pruebas automatizadas cubren repetición de búsquedas sin perder progreso comercial, deduplicación, escrituras concurrentes, rutas de archivos, fechas y canales inválidos, sesiones alteradas o vencidas, bloqueo de destinos privados y trabajadores concurrentes de publicaciones. Las llamadas externas de publicación están simuladas.

La comprobación visual incluye resumen en escritorio y móvil, navegación, cierre de diálogos con Escape y recuperación del diseño del editor. No se enviaron publicaciones, campañas ni mensajes comerciales reales para probar el proyecto. La generación con modelos locales, las credenciales de cada proveedor y los envíos reales requieren una comprobación operativa con las conexiones disponibles.

## Siguiente etapa como SaaS público

Se necesitan usuarios y organizaciones con aislamiento de datos, roles, base de datos transaccional, almacenamiento privado, cola persistente con worker independiente, cifrado y renovación de credenciales, límites de uso, trazabilidad y copias de seguridad. La facturación y los nuevos canales sociales necesitan sus integraciones correspondientes.

La versión actual mejora la operación local existente; esos componentes no se presentan como implementados.
