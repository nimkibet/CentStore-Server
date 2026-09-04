import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true // allows starting the server without immediate Redis connection failure
  });

  redisClient.on('error', (err) => {
    console.warn(`Redis Connection Warning: ${err.message}. Queues and worker functions will be unavailable, but the rest of the application will work.`);
  });

  redisClient.on('connect', () => {
    console.log('Redis connected successfully.');
  });
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
}

export default redisClient;
