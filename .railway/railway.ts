import { defineRailway, github, preserve, service, volume } from "railway/iac";

export default defineRailway((_ctx, project) => {
  const data = volume("rply-data", { sizeMB: 1024 });

  const server = service("rply", {
    source: github("joshuaKnauber/rply", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 60,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    volumeMounts: { "/data": data },
    env: { RPLY_ADMIN_TOKEN: preserve() },
  });

  return project("rply", { resources: [server, data] });
});
