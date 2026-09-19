import { disconnect } from "./db.js";
import { env } from "./env.js";
import { closeBrowser } from "./scraper/browser.js";
import { startScheduler } from "./scheduler.js";
import { buildServer } from "./server.js";

const app = await buildServer();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  startScheduler(app);
} catch (error) {
  app.log.error({ err: error }, "failed to start");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void (async () => {
      app.log.info(`${signal} received, shutting down`);
      await app.close();
      await closeBrowser();
      await disconnect();
      process.exit(0);
    })();
  });
}
