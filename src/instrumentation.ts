export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  )
    return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
  // El bot y todo lo que usa se cargan solo si está configurado.
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const { startTelegramBot } = await import("./lib/telegram/bot");
    startTelegramBot();
  }
}
