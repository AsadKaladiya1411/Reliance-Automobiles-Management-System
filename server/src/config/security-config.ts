type RuntimeEnvironment = "development" | "test" | "production";

const knownUnsafeJwtSecrets = new Set([
  "development-only-change-before-production",
  "change-this-before-production",
  "replace-with-a-long-random-secret",
]);

export function validateJwtSecret(secret: string, nodeEnv: RuntimeEnvironment) {
  if (nodeEnv === "production" && (secret.length < 32 || knownUnsafeJwtSecrets.has(secret.toLowerCase()))) {
    throw new Error("JWT_SECRET must be a unique random value of at least 32 characters in production.");
  }

  return secret;
}
