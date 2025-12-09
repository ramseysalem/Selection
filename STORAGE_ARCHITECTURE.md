# Outfit Matcher - Storage & Architecture Strategy

## Executive Summary

Your project has made good progress moving images to S3, but **3 major storage/data issues** remain:
1. **Location data** - Not being used; needs real-time geolocation
2. **Rate limiting** - In-memory only; breaks with scale
3. **User data** - No caching layer; database will bottleneck

---

## ISSUE #1: LOCATION/GEOLOCATION

### Current State ❌
- Users manually input city or coordinates
- Database has PostGIS location column but it's **completely unused**
- No IP-based geolocation
- No automatic weather for user location
- Frontend doesn't even ask for location

### Why This Matters
- **User Experience**: Users shouldn't have to type their city every time
- **Personalization**: Can't do location-based outfit suggestions
- **Weather Integration**: Weather is only used when manually requested

### Recommended Solution 🎯

**Step 1: Implement IP-Based Geolocation (MVP)**

Use a lightweight IP geolocation service:
- **MaxMind GeoLite2** (free tier) or **IP2Location** or **ipstack** API
- Add to backend environment:
  ```env
  GEOLOCATION_PROVIDER=maxmind|ipstack|ip2location
  MAXMIND_LICENSE_KEY=your-key
  ```

- Add new column to `users` table:
  ```sql
  ALTER TABLE users ADD COLUMN
    last_location_update TIMESTAMP,
    ip_geolocation_latitude DECIMAL(10,8),
    ip_geolocation_longitude DECIMAL(10,8),
    city VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(50);
  ```

**Step 2: Auto-Update Location on Each Request**

Create middleware that:
```typescript
// middleware/geoLocationMiddleware.ts
export const updateUserLocationFromIP = async (req: Request, res: Response, next: any) => {
  if (!req.user) return next();

  const userIP = req.ip;
  const user = await getUser(req.user.id);

  // Only update every 24 hours or if location missing
  if (!user.last_location_update ||
      Date.now() - user.last_location_update > 86400000) {

    const geoData = await getGeolocationFromIP(userIP);
    await updateUserLocation(req.user.id, {
      ip_geolocation_latitude: geoData.lat,
      ip_geolocation_longitude: geoData.lon,
      city: geoData.city,
      country: geoData.country,
      timezone: geoData.timezone,
      last_location_update: new Date()
    });
  }
  next();
};
```

**Step 3: Use PostGIS for Location-Based Queries** (Future)

Once location is populated, you can do:
```sql
-- Find all users within 10 miles of a location
SELECT * FROM users
WHERE ST_DWithin(
  location,
  ST_Point(-73.9352, 40.7306)::geography,
  16000  -- 10 miles in meters
);

-- Get user's location for weather
SELECT st_x(location) as lon, st_y(location) as lat
FROM users WHERE id = $1;
```

**Step 4: Frontend - Request Browser Location (Optional)**

If user allows, get exact location:
```typescript
// In Home.tsx or Layout.tsx
useEffect(() => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Save to user preferences
        await updateUserLocation(latitude, longitude);
      },
      (error) => {
        // Fall back to IP geolocation (handled by backend)
        console.log('Using IP geolocation fallback');
      }
    );
  }
}, []);
```

### Implementation Priority: **HIGH** ⚠️
- MVP (IP geolocation): 2-3 hours
- Full (with browser prompt): 4-5 hours
- Effort: Low-Medium
- Impact: High

---

## ISSUE #2: RATE LIMITING AT SCALE

### Current State ❌
```typescript
// In memory only - lost on restart, doesn't scale
const suspiciousIPs = new Map<string, { violations: number; blockedUntil?: Date }>();
```

**Problems**:
- Only works on single server
- Data lost on restart
- No distributed support (can't handle load balancing)
- Memory leaks from old entries (even with cleanup)
- Can't track across multiple instances

### Why This Matters
- **Scale**: If you run 2+ servers, rate limits are per-server
- **Reliability**: Restart = blocks are gone
- **Monitoring**: No persistence for logs/analytics

### Recommended Solution 🎯

**Move from In-Memory to Redis** (3-4 hour implementation)

#### Step 1: Set Up Redis

**Option A: Local Development**
```bash
# macOS
brew install redis
brew services start redis

# Or Docker
docker run -d -p 6379:6379 redis:latest
```

**Option B: Production (AWS)**
- AWS ElastiCache Redis (managed)
- Or simple Redis container on EC2

#### Step 2: Refactor Rate Limiting

Replace current `rateLimiting.ts`:

```typescript
// middleware/rateLimiting.ts
import redis from 'redis';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

interface BlockedIP {
  violations: number;
  blockedUntil?: number; // timestamp
  firstViolationTime: number;
}

export const checkBlockedIP = async (req: Request, res: Response, next: any) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `rate-limit:ip:${ip}`;

  const data = await redisClient.get(key);
  if (!data) return next();

  const blocked = JSON.parse(data) as BlockedIP;
  if (blocked.blockedUntil && blocked.blockedUntil > Date.now()) {
    const remainingTime = Math.ceil((blocked.blockedUntil - Date.now()) / 60000);
    return res.status(429).json({
      error: 'IP temporarily blocked',
      message: `Blocked for ${remainingTime} minutes`,
      blockedUntil: new Date(blocked.blockedUntil)
    });
  }
  next();
};

export const createRateLimitHandler = (limitType: string) => {
  return async (req: Request, res: Response) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `rate-limit:ip:${ip}`;

    // Get current violations
    const data = await redisClient.get(key);
    const blocked = data ? JSON.parse(data) : { violations: 0, firstViolationTime: Date.now() };

    blocked.violations += 1;

    // Progressive blocking
    if (blocked.violations >= 5) {
      const blockDuration = Math.min(blocked.violations * 5, 60) * 60000;
      blocked.blockedUntil = Date.now() + blockDuration;
      console.warn(`🚨 IP ${ip} blocked for ${blockDuration / 60000} minutes`);
    }

    // Store in Redis with TTL (24 hours)
    await redisClient.setex(key, 86400, JSON.stringify(blocked));

    res.status(429).json({
      error: 'Rate limit exceeded',
      type: limitType,
      message: 'Please wait before making more requests'
    });
  };
};

// Debug endpoint
export const getViolationsDebugInfo = async () => {
  const keys = await redisClient.keys('rate-limit:ip:*');
  const violations = [];

  for (const key of keys) {
    const data = await redisClient.get(key);
    if (data) {
      violations.push({
        ip: key.replace('rate-limit:ip:', ''),
        ...JSON.parse(data),
        blockedUntil: data.blockedUntil ? new Date(data.blockedUntil) : null
      });
    }
  }

  return { totalTrackedIPs: violations.length, violations };
};
```

#### Step 3: Environment Setup

```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-password

# Or single URL
REDIS_URL=redis://:password@localhost:6379/0
```

#### Step 4: Add Monitoring Dashboard (Optional)

```typescript
// routes/admin-debug.ts
router.get('/debug/rate-limits', async (req, res) => {
  const info = await getViolationsDebugInfo();
  res.json(info);
});

// Returns:
// {
//   totalTrackedIPs: 5,
//   violations: [
//     { ip: "192.168.1.1", violations: 3, blockedUntil: "2025-12-04T..." },
//     ...
//   ]
// }
```

### Implementation Priority: **VERY HIGH** ⚠️⚠️
- Basic implementation: 3-4 hours
- With monitoring: 4-5 hours
- Effort: Medium
- Impact: Very High (required for scale)

### Additional Redis Use Cases (While You're At It)

Once Redis is set up, also move to it:

```typescript
// 1. Weather caching (currently in-memory, lost on restart)
const weatherCache = redis;
await redis.setex(`weather:${city}`, 900, JSON.stringify(weatherData)); // 15 min

// 2. AI analysis results (expensive, cache for duplicates)
const aiCache = redis;
await redis.setex(`ai:analysis:${imageHash}`, 3600, JSON.stringify(analysis)); // 1 hour

// 3. Session data (better than in-memory)
// 4. User preferences (real-time sync across servers)
// 5. Real-time notification queues
```

---

## ISSUE #3: USER DATA STORAGE AT SCALE

### Current State ❌

All user data goes directly to PostgreSQL:
- ✅ Good: Structured data, relational integrity
- ❌ Bad: Every request hits database
- ❌ Bad: No caching layer
- ❌ Bad: Will bottleneck at 1000+ concurrent users

### What Needs Caching

```
HOT DATA (Cache in Redis)     COLD DATA (PostgreSQL Only)
├─ User profile               ├─ Email verification tokens
├─ Wardrobe items (list)      ├─ Password reset history
├─ User preferences           ├─ Account creation date
├─ Recent outfits             ├─ Billing info (if added)
├─ Fashion rules              └─ Full audit logs
└─ AI analysis results
```

### Recommended Solution 🎯

**Implement Redis Cache Layer** (4-5 hours)

#### Step 1: Create Cache Service

```typescript
// services/cacheService.ts
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL
});

interface CacheConfig {
  ttl: number; // seconds
  key: string;
}

export const CacheTTL = {
  USER_PROFILE: 3600,        // 1 hour
  WARDROBE_ITEMS: 300,       // 5 minutes (changes frequently)
  OUTFIT_RECOMMENDATIONS: 600, // 10 minutes
  AI_ANALYSIS: 86400,        // 24 hours (never changes)
  WEATHER: 900,              // 15 minutes
  USER_PREFERENCES: 3600     // 1 hour
};

export const cache = {
  // Get with auto-reload from DB if missing
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
    }

    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  },

  async set<T>(key: string, data: T, ttl: number = 300): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(data));
  },

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async delete(key: string): Promise<void> {
    await redis.del(key);
  },

  // Delete all keys matching pattern
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
  }
};

// Usage in services
export async function getUserProfile(userId: string) {
  return cache.getOrFetch(
    `user:${userId}:profile`,
    () => db.query('SELECT * FROM users WHERE id = $1', [userId]),
    CacheTTL.USER_PROFILE
  );
}

export async function getWardrobeItems(userId: string) {
  return cache.getOrFetch(
    `user:${userId}:wardrobe`,
    () => db.query('SELECT * FROM clothing_items WHERE user_id = $1', [userId]),
    CacheTTL.WARDROBE_ITEMS
  );
}

// Invalidate cache on updates
export async function updateWardrobeItem(itemId: string, userId: string, data: any) {
  await db.query('UPDATE clothing_items SET ... WHERE id = $1', [itemId]);

  // Invalidate related caches
  await cache.invalidatePattern(`user:${userId}:wardrobe*`);
  await cache.delete(`user:${userId}:wardrobe`);

  return getWardrobeItems(userId); // Refetch fresh
}
```

#### Step 2: Update API Endpoints

```typescript
// routes/wardrobe.ts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const items = await getWardrobeItems(req.user.id); // Uses cache
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wardrobe' });
  }
});

router.post('/', authenticateToken, uploadLimiter, async (req, res) => {
  // Create new item
  const newItem = await createWardrobeItem(req.user.id, itemData);

  // Invalidate user's wardrobe cache
  await cache.invalidatePattern(`user:${req.user.id}:wardrobe*`);

  res.json(newItem);
});
```

#### Step 3: Cache Invalidation Strategy

```typescript
// utils/cacheInvalidation.ts
export const invalidationRules = {
  // When wardrobe item is updated
  wardrobeItemUpdated: (userId: string, itemId: string) => [
    `user:${userId}:wardrobe`,
    `user:${userId}:wardrobe:items`,
    `user:${userId}:outfit:recommendations*`,
    `user:${userId}:style:rules` // Rules might use this item
  ],

  // When user preferences change
  userPreferencesUpdated: (userId: string) => [
    `user:${userId}:profile`,
    `user:${userId}:preferences`,
    `user:${userId}:outfit:recommendations*`
  ],

  // When outfit is saved
  outfitSaved: (userId: string) => [
    `user:${userId}:outfits`,
    `user:${userId}:outfit:recommendations*`
  ]
};

// Usage:
export async function updateWardrobeItem(userId: string, itemId: string, data: any) {
  await db.query('UPDATE clothing_items SET ... WHERE id = $1', [itemId]);

  const keysToInvalidate = invalidationRules.wardrobeItemUpdated(userId, itemId);
  for (const key of keysToInvalidate) {
    await cache.invalidatePattern(key);
  }
}
```

### Implementation Priority: **HIGH** ⚠️
- Basic caching: 3-4 hours
- With proper invalidation: 4-5 hours
- Effort: Medium
- Impact: High (10-100x faster queries)

---

## ISSUE #4: OTHER STORAGE IMPROVEMENTS

### A. Image Storage - Complete S3 Migration

**Current Problem**:
- Dual storage (database BYTEA + S3) creates complexity
- Need to deprecate BYTEA storage

**Solution** (1-2 hours):
```typescript
// Migration script
export async function migrateAllImagesToS3() {
  const items = await db.query(
    'SELECT id, image_data, user_id FROM clothing_items WHERE storage_type = $1',
    ['database']
  );

  for (const item of items) {
    // Upload to S3
    const s3Result = await uploadToS3(item.image_data);

    // Update database
    await db.query(
      'UPDATE clothing_items SET storage_type = $1, image_url = $2, image_s3_key = $3 WHERE id = $4',
      ['s3', s3Result.url, s3Result.key, item.id]
    );

    // Clear image_data to save space
    await db.query(
      'UPDATE clothing_items SET image_data = NULL WHERE id = $1',
      [item.id]
    );
  }
}
```

**Then remove** `image_data` column from schema after verification.

### B. Database Query Optimization

**Add indexes for common queries**:
```sql
-- Already have these, verify they exist:
CREATE INDEX idx_wardrobe_user_ai_analyzed
  ON clothing_items(user_id, ai_analyzed);

CREATE INDEX idx_outfits_user_weather
  ON weather_outfit_log(user_id, temperature);

CREATE INDEX idx_clothing_category_formality
  ON clothing_items(user_id, category, ai_formality_score);

-- For location-based queries (once geolocation is used)
CREATE INDEX idx_users_location
  ON users USING GIST(location);
```

### C. Email Queue System

**Instead of sending emails synchronously** (blocks request):

```typescript
// services/emailQueueService.ts
import Bull from 'bull';

const emailQueue = new Bull('emails', {
  redis: { url: process.env.REDIS_URL }
});

// Send email async
export async function queueEmail(to: string, subject: string, html: string) {
  await emailQueue.add(
    { to, subject, html },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
}

// Process queue (separate worker or same process)
emailQueue.process(async (job) => {
  await sendEmailViaSMTP(job.data.to, job.data.subject, job.data.html);
});

// Usage in routes - now non-blocking
export async function resetPassword(email: string) {
  const token = generateToken();
  await queueEmail(email, 'Password Reset', `Click here to reset: ...`);
  return { message: 'Email queued' };
}
```

### D. Analytics/Logging

**Instead of storing every action in DB**, log to Redis + periodic dump:

```typescript
// services/analyticsService.ts
export async function trackEvent(userId: string, eventType: string, data: any) {
  const key = `analytics:${new Date().toISOString().split('T')[0]}:${eventType}`;

  // Increment counter
  await redis.incr(`${key}:count`);

  // Store sample data (keep last 100)
  await redis.lpush(`${key}:samples`, JSON.stringify({ userId, data, timestamp: Date.now() }));
  await redis.ltrim(`${key}:samples`, 0, 99);

  // Set daily expiry
  await redis.expire(key, 86400 * 30); // 30 days
}

// Example: Track AI analysis usage
trackEvent(userId, 'ai_analysis', { itemCount: 1, confidence: 0.95 });
```

---

## OVERALL STORAGE ARCHITECTURE RECOMMENDATION

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (React)                         │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               API Layer (Express.js)                        │
│  - Authentication & Rate Limiting (Redis-based)            │
│  - Request validation & sanitization                       │
│  - Cache-first queries                                     │
└──────────┬──────────────────────────────┬──────────────────┘
           │                              │
           ▼                              ▼
    ┌────────────────┐          ┌──────────────────┐
    │  REDIS CACHE   │          │   POSTGRESQL     │
    ├────────────────┤          ├──────────────────┤
    │ • User data    │          │ • Wardrobe items │
    │ • Rate limits  │          │ • Users          │
    │ • Weather      │          │ • Outfits        │
    │ • AI analysis  │          │ • Style rules    │
    │ • Sessions     │          │ • Historical data│
    │ • Prefs        │          │ • Location (geo) │
    └────────────────┘          └──────────────────┘
           ▲                              ▲
           │ TTL: 5min-24hrs              │ Persistent
           │ Auto-invalidate              │
           │                              │
           └──────────────────────────────┘
                    Data Flow

    ┌────────────────┐          ┌──────────────────┐
    │   AWS S3       │          │  EXTERNAL APIs   │
    ├────────────────┤          ├──────────────────┤
    │ • User images  │          │ • OpenAI (AI)    │
    │ • Thumbnails   │          │ • Open-Meteo     │
    │ • Optimized    │          │ • IP Geolocation │
    │   versions     │          │                  │
    └────────────────┘          └──────────────────┘
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1) - **1-2 days of work**
- [ ] Set up Redis locally & production
- [ ] Move rate limiting to Redis
- [ ] Test with multiple server instances

### Phase 2: Geolocation (Week 1) - **2-3 days of work**
- [ ] Integrate IP geolocation service
- [ ] Update user schema for location
- [ ] Auto-detect user location on login
- [ ] Add browser geolocation permission prompt

### Phase 3: Caching (Week 2) - **3-4 days of work**
- [ ] Create cache service
- [ ] Implement cache for wardrobe items
- [ ] Implement cache invalidation strategy
- [ ] Monitor cache hit rates

### Phase 4: Optimization (Week 2-3) - **2-3 days of work**
- [ ] Complete S3 migration, remove BYTEA
- [ ] Add database indexes
- [ ] Implement email queue
- [ ] Add analytics tracking

### Phase 5: Monitoring (Week 3) - **1-2 days of work**
- [ ] Add Redis monitoring dashboard
- [ ] Database performance monitoring
- [ ] Cache hit rate metrics
- [ ] API latency tracking

---

## Environment Variables to Add

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Geolocation
GEOLOCATION_PROVIDER=maxmind
MAXMIND_LICENSE_KEY=your-key

# AWS S3 (already exists, ensure correct)
AWS_S3_BUCKET_NAME=outfit-matcher-images
STORAGE_TYPE=s3

# Analytics
ENABLE_ANALYTICS=true
ANALYTICS_SAMPLE_RATE=0.1

# Caching
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300
```

---

## Summary Table

| Issue | Current | Recommended | Priority | Effort | Impact |
|-------|---------|-------------|----------|--------|--------|
| **Geolocation** | Manual input | IP-based auto-detect | HIGH ⚠️ | 2-3h | High |
| **Rate Limiting** | In-memory | Redis-based | CRITICAL ⚠️⚠️ | 3-4h | Very High |
| **Caching** | None | Redis layer | HIGH ⚠️ | 4-5h | Very High |
| **Image Storage** | Dual (DB+S3) | S3 only | MEDIUM | 1-2h | Medium |
| **DB Indexes** | Basic | Optimized | MEDIUM | 1h | Medium |
| **Email Queue** | Synchronous | Async (Bull) | LOW | 2-3h | Low |
| **Analytics** | None | Redis-based | LOW | 2h | Low |

---

## Quick Win: Start Here

If you only have time for one thing: **Move rate limiting to Redis**
- Unblocks scaling to multiple servers
- Required for production
- Unlocks redis for other features
- 3-4 hours of work

Second priority: **Add IP geolocation**
- Improves UX significantly
- Auto-detect location beats manual input
- 2-3 hours of work

Then: **Add caching layer**
- Prepare for scale
- 10-100x performance improvement
- 4-5 hours of work
