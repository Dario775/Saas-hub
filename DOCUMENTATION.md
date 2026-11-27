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

### Flyers animados

"Animar" convierte un flyer terminado en un MP4 de 10, 12 o 15 segundos, con la placa final de la marca. Usa el mismo HTML del flyer (`src/lib/motion/motion-html.ts`) y le suma una coreografía GSAP por diseño (`tools/motion/runtime/choreography.js`). HyperFrames lo renderiza en local, sin GPU ni servicios externos.

- Cada video tiene un estilo (`src/lib/motion/styles.ts`) que fija el tempo y la música: enérgico (124 BPM, electrónico), equilibrado (110, pop), corporativo (100, arpegios) y tranquilo (84, lo-fi). "Automático" elige uno distinto en cada armado. La coreografía se escribe sobre una grilla de referencia a 120 BPM y su línea de tiempo se acelera o frena con el tempo: todo sigue cayendo en el golpe. La placa final entra justo en un tiempo y dura al menos 2,4 s.
- Tres tiempos sin cortes. Primero, un gancho de un compás (`MOTION_HOOK`): el titular en grande, palabra por palabra. Después, esas palabras viajan a su lugar exacto en el flyer y el diseño se arma alrededor. Al final, un círculo del color de acento crece desde el elemento clave (el ticket, el botón, el último mensaje) y se vuelve la placa de la marca. Si el titular ya ocupa casi todo el flyer (afirmación, oferta, objeto), no hay viaje y el diseño usa su entrada normal.
- Se graba a 150 fps y ffmpeg mezcla cada 5 cuadros en uno (`MOTION_SUBFRAMES`): el video sale a 30 fps con desenfoque de movimiento real.

- El renderizador vive en `tools/motion`, con sus propias dependencias. Se instala con `npm ci --prefix tools/motion --ignore-scripts`. Usa el Chrome que descarga HyperFrames en `~/.cache/hyperframes`.
- El sonido se genera en código: instrumentos en `synth.ts` y un arreglo por estilo en `sound.ts`, más una subida antes de la marca y un impacto cuando entra. Cada armado elige al azar (con semilla) una de cinco secuencias de acordes y una tonalidad, así que rehacer un video da otra música. No necesita archivos ni licencias.
- Si hay pistas en `motion-music/` (o en `MOTION_MUSIC_DIR`), el panel elige una por flyer y la usa en lugar del ritmo, con la subida y el impacto encima. Solo deben ir pistas libres de derechos; la carpeta no se sube a Git. ffmpeg (`FFMPEG_PATH`) mezcla todo y lo deja a -14 LUFS, el volumen de las redes.
- **A medida:** con el estilo "A medida", Claude (`MOTION_CUSTOM_MODEL`, Opus 5.5 por defecto) diseña la composición completa de cada video en lugar de usar la coreografía fija: concepto propio, escenas que se transforman y placa de marca obligatoria (`src/lib/motion/custom/`). El código que devuelve pasa tres filtros antes de grabarse: un control estático (sin red, azar, relojes, scripts externos ni archivos que no existen; `validate.ts`), una política de seguridad dentro del documento que bloquea toda conexión salvo las fuentes (`document.ts`) y `hyperframes validate`, que lo abre en Chrome. Claude tiene hasta dos correcciones. Después mira una hoja con 8 cuadros del borrador (`hyperframes snapshot`) y corrige una vez si ve textos cortados, superpuestos o ilegibles; si la corrección sale peor, queda el primer diseño. Cuesta alrededor de medio dólar y tarda unos minutos por video. La música sale de un estilo elegido al azar.
- El video queda en `public/generated-videos/` y se publica como cualquier otro video del panel. Se arma un video por vez. Si el flyer se ajusta, el video anterior se descarta.

## Publicaciones

Los endpoints comparten validación y `social-dispatcher.ts`. El motor nativo admite publicación directa y programada en Facebook, Instagram (Business/Reels), LinkedIn y X (Twitter). n8n ha sido completamente desvinculado del sistema.

El programador arranca desde `src/instrumentation.ts`, en el servidor Node y fuera de la compilación. Cada 30 segundos reclama publicaciones pendientes antes de realizar solicitudes externas. Un segundo proceso no puede reclamar al mismo tiempo la misma publicación.

Estados: `pending`, `publishing`, `scheduled`, `published`, `failed`. `scheduled` con `fbScheduled` significa que Facebook aceptó una programación nativa. El worker consulta el resultado después de la fecha; un error de consulta nunca provoca otro envío.

Si un envío queda sin resultado confirmado o un proceso muere, se requiere revisión manual. No se garantiza entrega exactamente una vez ante una caída de red: el proveedor puede haber aceptado un envío sin que su respuesta llegue. Antes de reintentar un caso incierto, comprobá Facebook.

Cancelar una programación nativa primero solicita su cancelación remota. El antiguo `scripts/facebook-native.mjs` fue retirado porque escribía fuera de estos controles y su modo de prueba generaba publicaciones reales.

Programar desde la web y desde el agente pasa por la misma función, `createScheduledPost` (`src/lib/schedule-service.ts`).

## Agente por Telegram

Un bot de Telegram recibe pedidos en texto o audio ("10 flyers y 5 videos para Obsidiana en 3 días"), crea las piezas con el módulo de flyers, las muestra y, cuando el usuario aprueba, las programa en Facebook. Después avisa cuando sale o falla cada publicación.

- **Conexión:** arranca desde `src/instrumentation.ts` si hay `TELEGRAM_BOT_TOKEN`, con "long polling": la PC pregunta a Telegram, sin abrir puertos ni exponer el panel. No corre con `SCHEDULER_ENABLED=false`, igual que el programador.
- **Acceso:** solo obedece a los ids de `TELEGRAM_ALLOWED_USERS`. A cualquier otra persona la ignora sin gastar tokens. Mientras la lista esté vacía, el bot solo responde con el id de quien le escribe, para poder configurarlo.
- **Modelo:** `AGENT_PROVIDER=claude` (por defecto, con `AGENT_MODEL`, Sonnet 5.5 si está vacío) u `ollama` (local, `LOCAL_LLM_MODEL`). El mismo modelo idea los flyers del agente, salvo que `AGENT_FLYER_MODEL` diga otro; con Ollama se usa `ollama:<modelo>`.
- **Pedido:** el modelo solo traduce el mensaje a una orden. `src/lib/agent/intent.ts` valida y acota la orden: marca existente, hasta 30 piezas, hasta 14 días, hasta 6 publicaciones por día. Si falta un dato, pregunta. También entiende el diseño de los flyers ("tipo chat", "tipo Excel", "con fotos": el director usa solo esos y puede repetirlos) y los horarios ("a las 10 y a las 20.30": los mismos cada día; si no alcanzan, los días se estiran hasta 14). Sin horarios pedidos, `slots.ts` los reparte sin IA: desde mañana (o la fecha pedida), parejos entre las 9 y las 21 h. Los videos van intercalados.
- **Campaña** (`campaign.ts`): crea flyers de a tandas de cuatro, anima los diseños que mejor lucen en movimiento (12 s, con sonido) y manda la vista previa con los botones "Programar todo" / "Cancelar". Si un video falla, esa pieza sale como imagen. Si el panel está ocupado con otro trabajo, espera. Un pedido por vez. `AGENT_AUTO_APPROVE=true` programa sin esperar la aprobación.
- **Audios:** se transcriben en la PC con el filtro `whisper` de ffmpeg (whisper.cpp) y el modelo ggml de `WHISPER_MODEL_PATH`. Sin ese modelo, el bot pide que el mensaje se escriba.
- **Datos:** `agent-data/` (fuera de Git) guarda las campañas, el estado del bot y los audios temporales.
- **Límite:** las imágenes se programan en Facebook mismo; los videos los publica el programador del panel, así que la PC tiene que estar prendida a esa hora.

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
