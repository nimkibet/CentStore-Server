import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;
let isRedisConnectedState = false;

// In-memory cache fallback for when Redis is offline or unavailable
const memoryCache = new Map();

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true
  });

  redisClient.on('error', (err) => {
    isRedisConnectedState = false;
  });

  redisClient.on('connect', () => {
    isRedisConnectedState = true;
  });

  redisClient.on('ready', () => {
    isRedisConnectedState = true;
  });

  redisClient.on('close', () => {
    isRedisConnectedState = false;
  });

  // Attempt connection non-blockingly without throwing uncaught errors
  redisClient.connect().catch(() => {
    isRedisConnectedState = false;
  });
} catch (error) {
  isRedisConnectedState = false;
}

export const isRedisConnected = () => {
  return isRedisConnectedState && redisClient?.status === 'ready';
};

/**
 * Retrieve a value from cache (Redis if available, else memory fallback).
 * @param {string} key
 * @returns {Promise<any>} parsed JSON or null
 */
export const getCache = async (key) => {
  try {
    if (isRedisConnected()) {
      const data = await redisClient.get(key);
      if (data !== null) {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return null;
    }
  } catch (err) {
    // Fall back to memoryCache on Redis read error
  }

  // Memory fallback
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
};

/**
 * Store a value in cache with TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds - defaults to 300 seconds
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
  const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;

  // Always update in-memory cache to guarantee fast local access and testability
  memoryCache.set(key, { value, expiresAt });

  try {
    if (isRedisConnected()) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, serialized);
      }
    }
  } catch (err) {
    // Redis write error ignored; memory cache already updated
  }
};

/**
 * Delete a key from cache.
 * @param {string} key
 */
export const delCache = async (key) => {
  memoryCache.delete(key);
  try {
    if (isRedisConnected()) {
      await redisClient.del(key);
    }
  } catch (err) {
    // Ignored
  }
};

/**
 * Clear all cache entries.
 */
export const clearCache = async () => {
  memoryCache.clear();
  try {
    if (isRedisConnected()) {
      await redisClient.flushdb();
    }
  } catch (err) {
    // Ignored
  }
};

// Aliases matching helper signatures
export const get = getCache;
export const set = setCache;
export const del = delCache;

export default redisClient;
