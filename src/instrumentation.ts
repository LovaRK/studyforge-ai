export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { container } = await import("@/server/container");
  const { logger } = await import("@/infrastructure/logging/logger");
  try {
    await container().ensureOwnerCredential();
    logger.info("owner credential ready");
  } catch (error) {
    // Login retries this lazily, so a database that is still starting is not fatal.
    logger.error("owner credential bootstrap failed", { error });
  }
}
