import "dotenv/config";
import app from "./app";
import { env } from "./config/env";

app.listen(env.port, env.host, () => {
  console.log(`RAMS API running on http://${env.host}:${env.port}`);
});
