const Redis = require("ioredis");
const config = require("./redisConfigFile").getConfig();
const tls_enabled = config?.tls_enabled === "yes";
const type = `${process.env.APP_TYPE} ioredis`;

function createRedisClient() {
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.redisSSL_TLS.auth_pass,
    tls: tls_enabled ? config.redisSSL_TLS.tls : undefined,
    maxRetriesPerRequest: 5, // Limit retries for a request
    keepAlive: 1000, // Ping Redis every 1 seconds
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 5000);
      console.warn(`${type}: event-retry_strategy Retrying Redis connection in ${delay}ms (Attempt: ${times})`);
      return times >= 10 ? null : delay;
    },
  });
}

const client = createRedisClient();

client.on("connect", () => {
  console.info(`${type}: event-connect Connected to Redis successfully.`);
});

client.on("error", (err) => {
  console.error(`${type}: event-error Redis connection error:`, err);
});

client.on("reconnecting", (delay) => {
  console.warn(`${type}: event-reconnecting Reconnecting to Redis in ${delay}ms...`);
});

client.on("end", () => {
  console.warn(`${type}: event-end Redis connection closed.`);
});

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