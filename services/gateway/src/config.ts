import { getEnv } from "@aegir/common";

export const config = {
  port: Number(getEnv("GATEWAY_PORT", "4000")),
  host: getEnv("GATEWAY_HOST", "0.0.0.0")!,
  services: {
    iam: getEnv("IAM_URL", "http://localhost:4001/graphql")!,
    agents: getEnv("AGENTS_URL", "http://localhost:4003/graphql")!,
  },
};
