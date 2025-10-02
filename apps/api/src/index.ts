import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "dotenv";

import { healthRoutes } from "./routes/health";
import { clientsRoutes } from "./routes/clients";
import { pingDb } from "./db";

config();

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(swagger, {
    openapi: { info: { title: "NovaFolio API", version: "0.1.0" } }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.register(healthRoutes);
  app.register(clientsRoutes);

  app.addHook("onReady", async () => {
    const ok = await pingDb().catch(() => false);
    if (!ok) app.log.error("No se pudo conectar a Postgres. Revisa DATABASE_URL.");
  });

  const port = Number(process.env.PORT || 4000);
  try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`API http://localhost:${port} (docs en /docs)`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
