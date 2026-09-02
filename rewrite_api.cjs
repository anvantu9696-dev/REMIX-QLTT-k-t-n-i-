const fs = require('fs');

let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');

// Add import for idbCache
if (!apiCode.includes("import { getCache, setCache, invalidateCacheByPrefix, clearAllCache } from './idbCache';")) {
  apiCode = apiCode.replace(
    "import { AuthSession,",
    "import { getCache, setCache, invalidateCacheByPrefix, clearAllCache } from './idbCache';\nimport { AuthSession,"
  );
}

// Define CustomRequestInit
if (!apiCode.includes("export interface CustomRequestInit")) {
  apiCode = apiCode.replace(
    "async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {",
    "export interface CustomRequestInit extends RequestInit {\n  cacheTtl?: number;\n  forceRefresh?: boolean;\n}\n\nasync function request<T>(endpoint: string, options: CustomRequestInit = {}): Promise<T> {"
  );
}

// Inject cache logic into request function
const requestLogic = `
  const maxRetries = 2;
  let attempt = 0;

  // Cache logic
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const shouldCache = isGet && options.cacheTtl && options.cacheTtl > 0;
  
  // Clean endpoint for cache key (remove dynamic _t parameter if it was added)
  const cacheKey = endpoint; 

  if (shouldCache && !options.forceRefresh) {
    const cachedData = await getCache<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }
  }

  // Add cache buster to GET requests
  let finalEndpoint = endpoint;
  if (isGet) {
    const separator = finalEndpoint.includes('?') ? '&' : '?';
    finalEndpoint = \`\${finalEndpoint}\${separator}_t=\${Date.now()}\`;
  }
`;

// we need to replace the exact block:
const searchBlock = `  const maxRetries = 2;
  let attempt = 0;

  // Add cache buster to GET requests
  let finalEndpoint = endpoint;
  if (!options.method || options.method.toUpperCase() === 'GET') {
    const separator = finalEndpoint.includes('?') ? '&' : '?';
    finalEndpoint = \`\${finalEndpoint}\${separator}_t=\${Date.now()}\`;
  }`;

apiCode = apiCode.replace(searchBlock, requestLogic);

// Add saving to cache after success
const successBlock = `      return data as T;
    } catch (error: any) {`;
const newSuccessBlock = `      if (shouldCache && response.ok) {
        // Save to cache
        await setCache(cacheKey, data as T, options.cacheTtl!);
      }
      return data as T;
    } catch (error: any) {`;
apiCode = apiCode.replace(successBlock, newSuccessBlock);

fs.writeFileSync('src/lib/api.ts', apiCode);
