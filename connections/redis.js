const asyncRedis = require('async-redis');
const config = require("./redisConfigFile").getConfig();
const tls_enabled = config?.tls_enabled === "yes";
const type = `${process.env.APP_TYPE} async-redis`;

function createRedisClient() {
  const client = asyncRedis.createClient({
    host: config.host,
    port: config.port,
    password: config.redisSSL_TLS.auth_pass,
    tls: tls_enabled ? {} : undefined,
    keepAlive: 1000, // Ping Redis every 1 seconds
    retry_strategy: (options) => {
      if (options.attempt > 5) {
        console.error(`${type}: event-retry_strategy Max retries reached. Not reconnecting.`);
        return null; // Stop retrying
      }
      const delay = Math.min(options.attempt * 500, 5000); // Start at 500ms, max 5s
      console.warn(`${type}: event-retry_strategy Retrying Redis connection in ${delay}ms...`);
      return delay;
    },
  });

  client.on("connect", () => console.info(`${type}: event-connect Connected to Redis successfully.`));
  client.on("error", (err) => console.error(`${type}: event-error Redis connection error:`, err));
  client.on("reconnecting", (delay) => console.warn(`${type}: event-reconnecting Reconnecting to Redis in ${delay}ms...`));
  client.on("end", () => console.warn(`${type}: event-end Redis connection closed.`));

  return client;
}

const client = createRedisClient();

process.on("SIGINT", async () => {
  console.info(`${type}: event-SIGINT Shutting down application. Closing Redis connection...`);
  await client.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.info(`${type}: event-SIGTERM Received termination signal. Closing Redis connection...`);
  await client.quit();
  process.exit(0);
});

module.exports = client;