/**
 * lifeGuideCache.js
 *
 * Cache layer for the 港漂通关手册 (Hong Kong Drifter Guidebook) tasks.
 * Wraps the queryLifeGuideTasks cloud function with a 24-hour TTL local cache.
 *
 * Strategy:
 *   User opens guidebook page
 *     ├─ Check wx.Storage cache + TTL
 *     │   └─ Cache valid (< 24 hours) → Return cached data immediately
 *     ├─ Cache expired OR no cache → Call cloud function
 *     │   ├─ Success → Write to wx.Storage with timestamp → Return data
 *     │   └─ Failure (network down)
 *     │       ├─ Has expired cache? → Return expired cache + set flag `stale: true`
 *     │       └─ No cache at all? → Return null (caller shows empty state + retry button)
 */

var CACHE_PREFIX = 'life-guide-cache-';
var TTL_MS = 86400000; // 24 hours

/**
 * Build a namespaced cache key for wx.Storage.
 * @param {string} suffix - Unique suffix identifying this query
 * @returns {string} Full storage key
 */
function buildKey(suffix) {
  return CACHE_PREFIX + suffix;
}

/**
 * Check whether a cached entry is still within the 24-hour TTL.
 * @param {string} key - Full wx.Storage key
 * @returns {boolean} true if cache exists and is fresh
 */
function isCacheValid(key) {
  try {
    var raw = wx.getStorageSync(key);
    if (!raw) return false;
    var cachedAt = new Date(raw.fetchedAt).getTime();
    if (isNaN(cachedAt)) return false;
    return (Date.now() - cachedAt) < TTL_MS;
  } catch (e) {
    console.error('[lifeGuideCache] isCacheValid error:', e);
    return false;
  }
}

/**
 * Get the age of a cached entry in milliseconds.
 * @param {string} key - Full wx.Storage key
 * @returns {number|null} Age in ms, or null if no cache exists
 */
function getCacheAge(key) {
  try {
    var raw = wx.getStorageSync(key);
    if (!raw) return null;
    var cachedAt = new Date(raw.fetchedAt).getTime();
    if (isNaN(cachedAt)) return null;
    return Date.now() - cachedAt;
  } catch (e) {
    console.error('[lifeGuideCache] getCacheAge error:', e);
    return null;
  }
}

/**
 * Read a raw cache entry from wx.Storage without TTL check.
 * @param {string} key - Full wx.Storage key
 * @returns {object|null} Cached data structure or null
 */
function readCacheData(key) {
  try {
    var raw = wx.getStorageSync(key);
    return raw || null;
  } catch (e) {
    console.error('[lifeGuideCache] readCacheData error:', e);
    return null;
  }
}

/**
 * Persist cloud function response to wx.Storage with a fetchedAt timestamp.
 * @param {string} key - Full wx.Storage key
 * @param {object} data - Raw cloud function response
 */
function writeCache(key, data) {
  try {
    wx.setStorageSync(key, {
      data: data,
      fetchedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[lifeGuideCache] writeCache error:', e);
  }
}

/**
 * Core fetch function.
 *
 * Tries cache first. If the cache is fresh, returns it immediately.
 * Otherwise calls the queryLifeGuideTasks cloud function. On success the
 * response is cached and returned. On failure the function falls back to
 * expired cached data (with stale flag) or null.
 *
 * @param {string}  mode   - Query mode, e.g. 'all' | 'byPath' | 'byStage' | ...
 * @param {*}       params - Parameters forwarded to the cloud function
 * @returns {Promise<{data?: object, fromCache?: boolean, stale?: boolean}|null>}
 */
function fetchTasks(mode, params) {
  // Normalise params to a deterministic suffix for the cache key.
  var suffix;
  if (mode === 'all' || !params) {
    suffix = mode;
  } else {
    try {
      suffix = mode + '-' + JSON.stringify(params);
    } catch (e) {
      suffix = mode;
    }
  }

  var key = buildKey(suffix);

  // ── 1. Check fresh cache ──
  if (isCacheValid(key)) {
    var cached = readCacheData(key);
    if (cached && cached.data) {
      return Promise.resolve({
        data: cached.data,
        fromCache: true,
        stale: false
      });
    }
  }

  // ── 2. No valid cache → call cloud function ──
  return new Promise(function (resolve) {
    wx.cloud.callFunction({
      name: 'queryLifeGuideTasks',
      data: {
        mode: mode,
        params: params || {}
      },
      success: function (res) {
        var result = res.result || {};
        // 去重：云函数可能返回重复数据
        if (result.data && Array.isArray(result.data)) {
          var deduped = [];
          var seenId = {};
          var seenTitle = {};
          result.data.forEach(function(t) {
            if (t._id && seenId[t._id]) return;
            if (t.title && seenTitle[t.title]) return;
            if (t._id) seenId[t._id] = true;
            if (t.title) seenTitle[t.title] = true;
            deduped.push(t);
          });
          result.data = deduped;
        }
        writeCache(key, result);
        resolve({
          data: result,
          fromCache: false,
          stale: false
        });
      },
      fail: function (err) {
        console.error('[lifeGuideCache] cloud function failed:', err);
        // ── 3a. Fall back to expired cache ──
        var expired = readCacheData(key);
        if (expired && expired.data) {
          resolve({
            data: expired.data,
            fromCache: true,
            stale: true
          });
          return;
        }
        // ── 3b. No cache at all ──
        resolve(null);
      }
    });
  });
}

/**
 * Convenience wrapper for fetching ALL tasks in 'all' mode.
 * Cache key: life-guide-cache-all
 *
 * @returns {Promise<{data?: object, fromCache?: boolean, stale?: boolean}|null>}
 */
function fetchAllTasks() {
  return fetchTasks('all', null);
}

/**
 * Convenience wrapper for fetching tasks by a specific life path.
 * Cache key: life-guide-cache-path-{visaType}-{familyStatus}-{arrivalScenario}
 *
 * @param {string} visaType         - Visa type (qmas/ttps-a/ttps-bc/asmt/iang/dependent)
 * @param {string} familyStatus     - Family status (single/couple/preschool/school-age/teen)
 * @param {string} arrivalScenario  - Arrival scenario (pre-arrival/fresh/delayed)
 * @param {string[]} [existingAssets] - Assets user already has (hkid/bank-account/rental/driving-license)
 * @returns {Promise<{data?: object, fromCache?: boolean, stale?: boolean}|null>}
 */
function fetchByPath(visaType, familyStatus, arrivalScenario, existingAssets) {
  var suffix = 'path-' + visaType + '-' + familyStatus + '-' + arrivalScenario + '-' + (existingAssets||[]).sort().join(',');
  var key = buildKey(suffix);

  // ── 1. Check fresh cache ──
  if (isCacheValid(key)) {
    var cached = readCacheData(key);
    if (cached && cached.data) {
      return Promise.resolve({
        data: cached.data,
        fromCache: true,
        stale: false
      });
    }
  }

  // ── 2. Call cloud function ──
  return new Promise(function (resolve) {
    wx.cloud.callFunction({
      name: 'queryLifeGuideTasks',
      data: {
        mode: 'byPath',
        params: {
          visaType: visaType,
          familyStatus: familyStatus,
          arrivalScenario: arrivalScenario,
          existingAssets: existingAssets || []
        }
      },
      success: function (res) {
        var result = res.result || {};
        writeCache(key, result);
        resolve({
          data: result,
          fromCache: false,
          stale: false
        });
      },
      fail: function (err) {
        console.error('[lifeGuideCache] fetchByPath cloud function failed:', err);
        var expired = readCacheData(key);
        if (expired && expired.data) {
          resolve({
            data: expired.data,
            fromCache: true,
            stale: true
          });
          return;
        }
        resolve(null);
      }
    });
  });
}

/**
 * Invalidate (remove) all cache entries whose key starts with the
 * life-guide-cache- prefix.
 */
function invalidateCache() {
  try {
    var info = wx.getStorageInfoSync();
    var keys = info.keys || [];
    var toRemove = [];
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(CACHE_PREFIX) === 0) {
        toRemove.push(keys[i]);
      }
    }
    toRemove.forEach(function (k) {
      wx.removeStorageSync(k);
    });
    console.log('[lifeGuideCache] invalidated ' + toRemove.length + ' cache entries');
  } catch (e) {
    console.error('[lifeGuideCache] invalidateCache error:', e);
  }
}

/**
 * Local data source: client-side assemblePath engine.
 * Synchronous — assemblePath runs instantly on local onboarding-tasks.js.
 * Used as the primary data source (方案C) for immediate offline-first render.
 *
 * @param {string} visaType
 * @param {string} familyStatus
 * @param {string} arrivalScenario
 * @param {string[]} [existingAssets]
 * @returns {{data: {tasks: Array, phases: Array, summary: Object}, source: string}}
 */
function fetchByPathLocal(visaType, familyStatus, arrivalScenario, existingAssets) {
  var assemblePath = require('../data/onboarding-paths').assemblePath;
  var result = assemblePath({
    visaType: visaType,
    familyStatus: familyStatus,
    arrivalScenario: arrivalScenario,
    existingAssets: existingAssets || []
  });
  return {
    data: { tasks: result.tasks, phases: result.phases, summary: result.summary },
    source: 'local'
  };
}

module.exports = {
  fetchTasks: fetchTasks,
  fetchAllTasks: fetchAllTasks,
  fetchByPath: fetchByPath,
  fetchByPathLocal: fetchByPathLocal,
  invalidateCache: invalidateCache,
  isCacheValid: isCacheValid,
  getCacheAge: getCacheAge
};
