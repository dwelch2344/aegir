import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("System Service", () => {
  let fastify: FastifyInstance;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const result = await buildApp();
    fastify = result.fastify;
    stop = () => result.app.stop();
    await fastify.ready();
  });

  afterAll(async () => {
    await stop();
  });

  it("responds to health check", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/health",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "system" });
  });

  it("serves the federated schema", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query: "{ _service { sdl } }",
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data._service.sdl).toContain("type Tenant");
    expect(body.data._service.sdl).toContain("type TenantOps");
    expect(body.data._service.sdl).toContain("type SystemIntegration");
    expect(body.data._service.sdl).toContain("type System");
  });

  it("queries a tenant by key", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query: '{ tenant(key: "aegir") { id key name } }',
      },
    });
    expect(response.statusCode).toBe(200);
    const tenant = response.json().data.tenant;
    expect(tenant).toMatchObject({
      id: "1",
      key: "aegir",
      name: "aegir Inc.",
    });
  });

  it("queries tenant integrations", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          '{ tenant(key: "aegir") { integrations { integrationKey status name } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    const integrations = response.json().data.tenant.integrations;
    expect(integrations).toHaveLength(3);
    expect(integrations[0]).toMatchObject({
      integrationKey: "github",
      status: "ACTIVE",
    });
  });

  it("searches system integrations", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          "{ system { integrations { search(input: {}) { results { id key name } } } } }",
      },
    });
    expect(response.statusCode).toBe(200);
    const results = response.json().data.system.integrations.search.results;
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ id: 1, key: "keycloak" });
  });

  it("creates a new tenant", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          'mutation { system { createTenant(input: { key: "newco", name: "New Co" }) { id key name } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    const tenant = response.json().data.system.createTenant;
    expect(tenant.key).toBe("newco");
    expect(tenant.name).toBe("New Co");
    expect(tenant.id).toBeTruthy();
  });

  it("upserts an integration", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          'mutation { system { upsertIntegration(input: { key: "jira", name: "Jira" }) { id key name } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    const integration = response.json().data.system.upsertIntegration;
    expect(integration.key).toBe("jira");
    expect(integration.name).toBe("Jira");
  });

  it("upserts a tenant integration", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          'mutation { tenant(key: "aegir") { integrations { upsert(input: { integrationKey: "jira", status: ACTIVE, name: "Jira" }) { integrationKey status name } } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    const ti = response.json().data.tenant.integrations.upsert;
    expect(ti).toMatchObject({
      integrationKey: "jira",
      status: "ACTIVE",
      name: "Jira",
    });
  });

  it("updates an existing tenant", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          'mutation { system { updateTenant(key: "aegir", input: { name: "Aegir Platform" }) { id key name } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    const tenant = response.json().data.system.updateTenant;
    expect(tenant.key).toBe("aegir");
    expect(tenant.name).toBe("Aegir Platform");
  });
});
