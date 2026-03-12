import { createApp } from "@moribashi/core";
import { webPlugin } from "@moribashi/web";
import { pgPlugin } from "@moribashi/pg";
import type { ResolverMap } from "@moribashi/graphql";
import type { FastifyInstance } from "fastify";
import federation from "@mercuriusjs/federation";
import { getEnv } from "@aegir/common";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Wrap resolvers so `this` is bound to the request scope cradle (same as @moribashi/graphql) */
function bindResolversToScope(map: ResolverMap<any>) {
  const bound: Record<string, Record<string, Function>> = {};
  for (const [type, fields] of Object.entries(map)) {
    bound[type] = {};
    for (const [field, fn] of Object.entries(fields)) {
      if (typeof fn === "function") {
        bound[type][field] = (parent: any, args: any, ctx: any, info: any) => {
          const scope = ctx.scope;
          const target = scope?.cradle ?? scope?.container?.cradle ?? {};
          return (fn as Function).call(target, parent, args, ctx, info);
        };
      } else {
        bound[type][field] = fn;
      }
    }
  }
  return bound;
}

export async function buildApp() {
  const app = createApp();

  app.use(
    webPlugin({
      port: Number(getEnv("IAM_PORT", "4001")),
      host: getEnv("IAM_HOST", "0.0.0.0"),
    }),
  );

  app.use(
    pgPlugin({
      host: getEnv("PG_HOST", "postgres"),
      port: Number(getEnv("PG_PORT", "5432")),
      user: getEnv("PG_USER", "iam_svc"),
      password: getEnv("PG_PASSWORD", "iam_dev"),
      database: getEnv("PG_DATABASE", "aegir"),
      searchPath: [getEnv("PG_SCHEMA", "iam")],
      migrationsDir: join(__dirname, "..", "data", "migrations"),
    }),
  );

  await app.scan(["**/*.svc.ts"], { cwd: __dirname });

  const fastify = app.resolve<FastifyInstance>("fastify");

  // Federation for gateway compatibility; bindResolversToScope for moribashi DI pattern
  fastify.register(federation as any, {
    schema: typeDefs,
    resolvers: bindResolversToScope(resolvers),
    graphiql: true,
    subscription: true,
    context: async (request: any) => ({ scope: request.scope }),
  });

  fastify.get("/health", async () => ({ status: "ok", service: "iam" }));

  // Programmatic push example: POST a notification to all matching subscribers.
  // Subscribers using iamNotifications(topic: "...") will only receive messages
  // whose topic matches their filter — this is the "find connections, filter by
  // property, send a message" pattern via pub/sub + withFilter.
  fastify.post<{ Body: { topic: string; message: string } }>(
    "/iam/notify",
    async (request) => {
      const { topic, message } = request.body;
      fastify.graphql.pubsub.publish({
        topic: "IAM_NOTIFICATIONS",
        payload: {
          iamNotifications: {
            id: Date.now().toString(),
            topic: topic ?? "general",
            message,
            sentAt: new Date().toISOString(),
          },
        },
      });
      return { status: "sent", topic, message };
    },
  );

  return { app, fastify };
}
