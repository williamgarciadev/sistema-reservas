import Redis from 'ioredis';
import { config } from '../config/index.js';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis conectado');
});

export default redis;
