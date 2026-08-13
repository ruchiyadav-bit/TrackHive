const Redis = require('ioredis');

let redis;

const connectRedis = () => {
  const options = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) {
        console.error('Redis: max retries reached, giving up');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  };

  if (process.env.REDIS_PASSWORD) {
    options.password = process.env.REDIS_PASSWORD;
  }

  redis = new Redis(options);

  redis.on('connect', () => {
    console.log('Redis connected');
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  return redis;
};

const getRedis = () => redis;

module.exports = { connectRedis, getRedis };
