let redis = null;

const connectRedis = () => {
  // Redis is optional — skip if no REDIS_HOST configured
  if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
    console.log('Redis: not configured, running without Redis (IP capping disabled)');
    return null;
  }

  try {
    const Redis = require('ioredis');

    let client;
    if (process.env.REDIS_URL) {
      client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 10) return null;
          return Math.min(times * 200, 2000);
        },
      });
    } else {
      const options = {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 10) return null;
          return Math.min(times * 200, 2000);
        },
      };
      if (process.env.REDIS_PASSWORD) {
        options.password = process.env.REDIS_PASSWORD;
      }
      client = new Redis(options);
    }

    client.on('connect', () => {
      console.log('Redis connected');
    });

    client.on('error', (err) => {
      console.error('Redis error:', err.message);
    });

    redis = client;
    return redis;
  } catch (err) {
    console.warn('Redis: failed to initialize, running without Redis:', err.message);
    return null;
  }
};

const getRedis = () => redis;

module.exports = { connectRedis, getRedis };
