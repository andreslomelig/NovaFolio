import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config } from "dotenv";

import { healthRoutes } from "./routes/health";
import { clientsRoutes } from "./routes/clients";
import { casesRoutes } from "./routes/cases";
import { documentsRoutes } from "./routes/documents";
import { pingDb, getDefaultTenantId } from "./db";
import { ensureStorageDir } from "./storage"; 

config();

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true, // refleja el Origin que llega (localhost, 192.168.x.x)
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    exposedHeaders: ["Content-Length", "ETag"],
    credentials: true,
    maxAge: 86400, // cachea la respuesta de preflight 1 día
  });
  await app.register(swagger, { openapi: { info: { title: "NovaFolio API", version: "0.1.0" } } });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(multipart);

  // ⬇️ Resuelve SIEMPRE a ruta absoluta y crea el directorio
  const storageDir = ensureStorageDir();
  await app.register(fastifyStatic, { root: storageDir, prefix: "/files/" });
  app.log.info({ storageDir }, "Serving uploads");

  // Warm-up
  const ok = await pingDb().catch(() => false);
  if (!ok) app.log.error("No se pudo conectar a Postgres. Revisa DATABASE_URL.");
  const tid = await getDefaultTenantId().catch((e) => {
    app.log.error(e, "No se pudo obtener/crear el tenant por defecto.");
    process.exit(1);
  });
  app.log.info({ tenantId: tid }, "Default tenant OK");

  // Rutas
  app.register(healthRoutes);
  app.register(clientsRoutes);
  app.register(casesRoutes);
  app.register(documentsRoutes);

  const port = Number(process.env.PORT || 4000);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API http://localhost:${port} (docs en /docs)`);
}

main();
