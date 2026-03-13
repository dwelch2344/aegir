import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("IAM Service", () => {
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
    expect(response.json()).toEqual({ status: "ok", service: "iam" });
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
    expect(body.data._service.sdl).toContain("type Identity");
    expect(body.data._service.sdl).toContain("type Organization");
    expect(body.data._service.sdl).toContain("type Iam");
    expect(body.data._service.sdl).toContain("type Mutation");
  });

  it("returns all identities when no filters", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          "{ iam { identities { search(input: {}) { results { id type label email } } } } }",
      },
    });
    expect(response.statusCode).toBe(200);
    const results = response.json().data.iam.identities.search.results;
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      id: 1,
      type: "SUPER_USER",
      label: "System",
      email: "system@aegir.dev",
    });
  });

  it("filters identities by idIn", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          "{ iam { identities { search(input: { idIn: [2] }) { results { id label } } } } }",
      },
    });
    expect(response.statusCode).toBe(200);
    const results = response.json().data.iam.identities.search.results;
    expect(results).toEqual([{ id: 2, label: "Alice Chen" }]);
  });

  it("filters identities by labelLike", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          '{ iam { identities { search(input: { labelLike: "bob" }) { results { id } } } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.iam.identities.search.results).toEqual([
      { id: 3 },
    ]);
  });

  it("returns all organizations when no filters", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          "{ iam { orgs { search(input: {}) { results { id key name protected } } } } }",
      },
    });
    expect(response.statusCode).toBe(200);
    const results = response.json().data.iam.orgs.search.results;
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      id: 1,
      key: "system",
      name: "System",
      protected: true,
    });
    expect(results[1]).toMatchObject({
      id: 2,
      key: "aegir",
      name: "aegir Inc.",
      protected: false,
    });
  });

  it("filters organizations by keyLike", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query:
          '{ iam { orgs { search(input: { keyLike: "aegir" }) { results { id key } } } } }',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.iam.orgs.search.results).toEqual([
      { id: 2, key: "aegir" },
    ]);
  });
});
