// ==========================================================================
// Next.js Instrumentation Hook: هنگام بالا آمدن سرور اجرا می‌شود تا همه‌ی
// تریگرهای زنده‌ی Workflowهای فعال (Schedule/MQTT/File Watcher/CDC) را
// راه‌اندازی کند.
// ==========================================================================
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapAllTriggers } = await import("@/lib/workflow/triggerManager");
    await bootstrapAllTriggers();
  }
}
