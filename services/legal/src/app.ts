import { createApp } from "@moribashi/core";
import { webPlugin } from "@moribashi/web";
import { pgPlugin } from "@moribashi/pg";
import type { FastifyInstance } from "fastify";
import federation from "@mercuriusjs/federation";
import { getEnv } from "@aegir/common";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = createApp();

  app.use(
    webPlugin({
      port: Number(getEnv("LEGAL_PORT", "4002")),
      host: getEnv("LEGAL_HOST", "0.0.0.0"),
    }),
  );

  app.use(
    pgPlugin({
      host: getEnv("PG_HOST", "postgres"),
      port: Number(getEnv("PG_PORT", "5432")),
      user: getEnv("PG_USER", "legal_svc"),
      password: getEnv("PG_PASSWORD", "legal_dev"),
      database: getEnv("PG_DATABASE", "aegir"),
      searchPath: [getEnv("PG_SCHEMA", "legal")],
      migrationsDir: join(__dirname, "..", "data", "migrations"),
    }),
  );

  await app.scan(["**/*.svc.ts"], { cwd: __dirname });

  const fastify = app.resolve<FastifyInstance>("fastify");

  // Cast needed: @mercuriusjs/federation types lag behind Fastify 5's register overloads
  fastify.register(federation as any, {
    schema: typeDefs,
    resolvers,
    graphiql: true,
  });

  fastify.get("/health", async () => ({ status: "ok", service: "legal" }));

  return { app, fastify };
}
