# SaaS Hub

Espacio local para gestionar marcas, crear contenido con IA, diseñar piezas, programar publicaciones de Facebook y dar seguimiento a oportunidades comerciales.

El panel reúne Obsidiana, Fucsia, NeuroCortex y las páginas que conectes. El resumen muestra datos del calendario de la marca seleccionada, pendientes de confirmación y conexiones configuradas.

## Empezar

Requiere Node.js 22 o superior y almacenamiento local persistente.

```sh
npm ci
npm run dev
```

Abrí http://127.0.0.1:3000. En Windows, `start-saas-hub.bat` inicia el panel en el puerto 3001. ComfyUI y el servidor de Canva se gestionan bajo demanda; el motor de publicaciones multired es completamente nativo e independiente.

Para una instalación nueva, copiá `.env.example` a `.env.local` y completá las conexiones necesarias. Conservá cualquier configuración existente. Las claves de IA y Google Places también se pueden guardar desde el panel.

Para ejecutar la versión compilada:

```sh
npm run build
npm start
```

## Funciones

- **Resumen:** actividad por marca, publicaciones por revisar y accesos al flujo de trabajo.
- **Estudio creativo:** propuestas de contenido basadas en la identidad de marca.
- **Imágenes y video:** ComfyUI, proveedores de IA y Canva. Cada herramienta requiere su conexión y, en el caso local, sus modelos.
- **Editor:** capas, texto, fondos, formatos y exportación PNG. El diseño se guarda por marca en el navegador.
- **Campañas y publicaciones:** preparación de contenidos, publicación directa y programación en Facebook.
- **Clientes y oportunidades:** búsqueda de comercios, notas, estados y demos comerciales para NeuroCortex.
- **Identidad:** colores, tono y propuesta de valor guardados en el equipo.

El texto de publicación se recupera por marca en el mismo navegador. Las imágenes y videos seleccionados para publicar se mantienen durante la sesión; los diseños del editor se guardan en IndexedDB.

## Acceso y programación

El arranque predeterminado escucha solamente en este equipo. `HUB_PASSWORD` activa un acceso con contraseña para un administrador; reiniciá después de cambiarla. `PUBLIC_APP_URL` define el origen autorizado si configurás un proxy.

El programador procesa la cola mientras el servidor está encendido. Algunas publicaciones con imagen se delegan a Facebook; el panel las distingue de la cola local. Usá `SCHEDULER_ENABLED=false` en pruebas o vistas previas para evitar procesar publicaciones reales.

Los resultados inciertos requieren revisión manual antes de reintentar. El sistema evita reenvíos automáticos después de una respuesta ambigua de Facebook.

## Verificación

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm audit
```

Las pruebas usan datos temporales y respuestas simuladas. El código heredado conserva avisos de tipado y optimización.

## Alcance

Es una herramienta local para un administrador, con Facebook como canal de publicación implementado. No incluye cuentas de clientes aisladas, roles de equipo, cobros ni una cola distribuida. Para ofrecerla como SaaS público se necesitan esos componentes y almacenamiento externo.

La arquitectura y la operación están en [DOCUMENTATION.md](DOCUMENTATION.md).
