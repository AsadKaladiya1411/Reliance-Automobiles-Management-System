type NodeEnv = "development" | "test" | "production";

export type AppEnv = {
  nodeEnv: NodeEnv;
  port: number;
  clientUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieName: string;
  passwordSaltRounds: number;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string | undefined) {
  const port = Number(value ?? "5000");

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }

  return port;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }

  return "development";
}

function parseSaltRounds(value: string | undefined) {
  const rounds = Number(value ?? "12");

  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
    throw new Error("PASSWORD_SALT_ROUNDS must be an integer between 10 and 14.");
  }

  return rounds;
}

export const env: AppEnv = {
  nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  port: parsePort(process.env.PORT),
  clientUrl: requireEnv("CLIENT_URL"),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  cookieName: process.env.AUTH_COOKIE_NAME || "rams_session",
  passwordSaltRounds: parseSaltRounds(process.env.PASSWORD_SALT_ROUNDS),
};
