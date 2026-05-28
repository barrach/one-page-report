import { getCurrentBuildInfo } from "@budget/lib/buildVersion";

const BUILD_STORAGE_KEY = "megabudget:build-signature";
const TARGET_BUILD_STORAGE_KEY = "megabudget:target-build-signature";
const RELOAD_ATTEMPTS_KEY = "megabudget:reload-attempts";
const UI_STATE_KEYS = ["financeiro:workspace-state:v3", "megabudget_imports"] as const;
const UI_STATE_PREFIXES = ["megabudget:", "financeiro:"] as const;
const PRESERVED_STORAGE_KEYS = new Set([BUILD_STORAGE_KEY, TARGET_BUILD_STORAGE_KEY, "pwa-install-dismissed"]);
const STALE_INDEXED_DB_PATTERNS = [/megabudget/i, /financeiro/i, /workbox/i, /pwa/i, /vite/i];
const BUILD_CHECK_INTERVAL_MS = 10_000;
const BUILD_INFO_ENDPOINT = "/build-info.json";
const BUILD_META_SELECTOR = 'meta[name="app-build-id"]';
const ENTRY_SCRIPT_SELECTOR = 'script[type="module"][src]';
const BUILD_SYNC_PARAM = "__build_sync";
const BUILD_RETRY_DELAY_MS = 1_200;
const BUILD_STATUS_ELEMENT_ID = "megabudget-build-sync-status";
const HTML_BUILD_STATUS_ELEMENT_ID = "megabudget-html-build-sync-status";
const INITIAL_BUILD_CHECK_ATTEMPTS = 3;
const MAX_RELOAD_ATTEMPTS_PER_BUILD = 2;
const BUILD_FETCH_TIMEOUT_MS = 2_500;

type PublishedBuildInfo = {
  buildId: string | null;
  entryScript: string | null;
  assetHash: string | null;
  signature: string | null;
};

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const isPreviewContext = isPreviewHost || isInIframe;

const resolveAbsoluteUrl = (value: string | null, base = window.location.origin) => {
  if (!value) return null;

  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
};

const normalizePublishedBuildInfo = (payload: Partial<PublishedBuildInfo>, base?: string): PublishedBuildInfo => {
  const normalizedEntryScript = resolveAbsoluteUrl(payload.entryScript ?? null, base ?? window.location.origin);
  const buildId = payload.buildId ?? null;
  const assetHash = payload.assetHash ?? null;
  const derivedSignature = [buildId, normalizedEntryScript].filter(Boolean).join("|");
  const signature = derivedSignature || payload.signature || null;

  return {
    buildId,
    entryScript: normalizedEntryScript,
    assetHash,
    signature,
  };
};

const readReloadAttempts = () => {
  try {
    const rawValue = window.sessionStorage.getItem(RELOAD_ATTEMPTS_KEY);
    if (!rawValue) return {} as Record<string, number>;

    const parsed = JSON.parse(rawValue) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, number>;
  }
};

const writeReloadAttempts = (attempts: Record<string, number>) => {
  try {
    window.sessionStorage.setItem(RELOAD_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // ignore storage errors
  }
};

const getReloadAttemptsForTarget = (targetSignature: string) => {
  return readReloadAttempts()[targetSignature] ?? 0;
};

const markReloadAttemptForTarget = (targetSignature: string) => {
  const attempts = readReloadAttempts();
  attempts[targetSignature] = (attempts[targetSignature] ?? 0) + 1;
  writeReloadAttempts(attempts);
};

const clearReloadAttemptsForTarget = (targetSignature: string) => {
  const attempts = readReloadAttempts();
  if (!(targetSignature in attempts)) return;

  delete attempts[targetSignature];
  writeReloadAttempts(attempts);
};

const clearClientUiState = () => {
  try {
    UI_STATE_KEYS.forEach((key) => window.localStorage.removeItem(key));

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey || PRESERVED_STORAGE_KEYS.has(storageKey)) continue;
      if (UI_STATE_PREFIXES.some((prefix) => storageKey.startsWith(prefix))) {
        window.localStorage.removeItem(storageKey);
      }
    }

    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const storageKey = window.sessionStorage.key(index);
      if (!storageKey || storageKey === RELOAD_ATTEMPTS_KEY) continue;
      if (UI_STATE_PREFIXES.some((prefix) => storageKey.startsWith(prefix))) {
        window.sessionStorage.removeItem(storageKey);
      }
    }
  } catch {
    // ignore storage errors
  }
};

const deleteIndexedDb = (name: string) =>
  new Promise<void>((resolve) => {
    try {
      const request = window.indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });

const clearStaleIndexedDb = async () => {
  if (!("indexedDB" in window)) return;

  try {
    if (typeof window.indexedDB.databases !== "function") return;
    const databases = await window.indexedDB.databases();
    await Promise.all(
      databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name))
        .filter((name) => STALE_INDEXED_DB_PATTERNS.some((pattern) => pattern.test(name)))
        .map((name) => deleteIndexedDb(name)),
    );
  } catch {
    // ignore IndexedDB cleanup errors
  }
};

const getComparableBuildSignature = (buildInfo: Pick<PublishedBuildInfo, "buildId" | "assetHash" | "entryScript" | "signature">) => {
  if (buildInfo.assetHash) return `${buildInfo.buildId ?? "unknown"}|${buildInfo.assetHash}`;

  const hashMatch = buildInfo.entryScript?.match(/-([a-z0-9]{6,})\./i);
  if (hashMatch) return `${buildInfo.buildId ?? "unknown"}|${hashMatch[1].slice(0, 8)}`;

  return buildInfo.signature ?? null;
};

const getBuildTimestamp = (signature: string | null | undefined) => {
  const buildId = signature?.split("|")[0];
  const timestamp = buildId ? Date.parse(buildId) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isSignatureNewerThan = (candidate: string | null | undefined, baseline: string | null | undefined) => {
  const candidateTime = getBuildTimestamp(candidate);
  const baselineTime = getBuildTimestamp(baseline);
  if (candidateTime !== baselineTime) return candidateTime > baselineTime;
  return Boolean(candidate && baseline && candidate !== baseline);
};

const isSignatureAtLeast = (candidate: string | null | undefined, expected: string | null | undefined) => {
  if (!expected) return Boolean(candidate);
  if (!candidate) return false;
  return candidate === expected || isSignatureNewerThan(candidate, expected);
};

const rememberNewestBuildSignature = (signature: string | null | undefined) => {
  if (!signature) return;

  try {
    const storedSignature = window.localStorage.getItem(BUILD_STORAGE_KEY);
    if (!storedSignature || isSignatureNewerThan(signature, storedSignature)) {
      window.localStorage.setItem(BUILD_STORAGE_KEY, signature);
    }
  } catch {
    // ignore storage errors
  }
};

const forceRefreshToLatestBuild = (buildSignature: string) => {
  if (getReloadAttemptsForTarget(buildSignature) >= MAX_RELOAD_ATTEMPTS_PER_BUILD) {
    clearReloadAttemptsForTarget(buildSignature);
    try {
      window.localStorage.removeItem(TARGET_BUILD_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    return false;
  }

  markReloadAttemptForTarget(buildSignature);

  try {
    window.localStorage.setItem(TARGET_BUILD_STORAGE_KEY, buildSignature);
  } catch {
    // ignore storage errors
  }

  try {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(BUILD_SYNC_PARAM, buildSignature);
    nextUrl.searchParams.set("__ts", `${Date.now()}`);
    window.location.replace(nextUrl.toString());
    return true;
  } catch {
    window.location.reload();
  }

  return true;
};

const showBuildSyncStatus = (message: string) => {
  if (typeof document === "undefined") return;

  let statusElement = document.getElementById(BUILD_STATUS_ELEMENT_ID);
  if (!statusElement) {
    statusElement = document.createElement("div");
    statusElement.id = BUILD_STATUS_ELEMENT_ID;
    statusElement.setAttribute("role", "status");
    statusElement.setAttribute("aria-live", "polite");
    statusElement.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:grid",
      "place-items:center",
      "background:#0b0f1a",
      "color:#f8fafc",
      "font:500 15px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "letter-spacing:0",
    ].join(";");
    document.body.appendChild(statusElement);
  }

  statusElement.textContent = message;
};

const hideBuildSyncStatus = () => {
  if (typeof document === "undefined") return;

  document.getElementById(BUILD_STATUS_ELEMENT_ID)?.remove();
  document.getElementById(HTML_BUILD_STATUS_ELEMENT_ID)?.remove();
};

const syncPublishedBuild = () => {
  try {
    const currentSignature = getCurrentBuildInfo().signature;
    const previousBuildSignature = window.localStorage.getItem(BUILD_STORAGE_KEY);
    const targetBuildSignature = window.localStorage.getItem(TARGET_BUILD_STORAGE_KEY);
    rememberNewestBuildSignature(currentSignature);

    if (currentSignature && targetBuildSignature === currentSignature) {
      window.localStorage.removeItem(TARGET_BUILD_STORAGE_KEY);
      clearReloadAttemptsForTarget(currentSignature);
    }

    if (currentSignature && previousBuildSignature && previousBuildSignature !== currentSignature) {
      clearClientUiState();
      void clearStaleIndexedDb();
      clearReloadAttemptsForTarget(currentSignature);
      return true;
    }
  } catch {
    // ignore storage errors
  }

  return false;
};

const fetchLatestPublishedBuildInfo = async (): Promise<PublishedBuildInfo | null> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BUILD_FETCH_TIMEOUT_MS);

  try {
    const buildInfoUrl = new URL(BUILD_INFO_ENDPOINT, window.location.origin);
    buildInfoUrl.searchParams.set("__lovable_build_check", `${Date.now()}`);

    const buildInfoResponse = await fetch(buildInfoUrl.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (buildInfoResponse.ok) {
      const payload = (await buildInfoResponse.json()) as Partial<PublishedBuildInfo>;
      const normalizedPayload = normalizePublishedBuildInfo(payload, buildInfoResponse.url);
      if (normalizedPayload.signature) return normalizedPayload;
    }
  } catch {
    // fall back to html parsing below
  }

  try {
    const publishedUrl = new URL("/", window.location.origin);
    publishedUrl.searchParams.set("__lovable_build_check", `${Date.now()}`);

    const response = await fetch(publishedUrl.toString(), {
      cache: "reload",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const latestBuildId = doc.querySelector(BUILD_META_SELECTOR)?.getAttribute("content") ?? null;
    const latestEntryScript = doc.querySelector(ENTRY_SCRIPT_SELECTOR)?.getAttribute("src") ?? null;

    return normalizePublishedBuildInfo(
      {
        buildId: latestBuildId,
        entryScript: latestEntryScript,
      },
      response.url || publishedUrl.toString(),
    );
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const fetchLatestPublishedBuildInfoWithRetry = async (attempts = INITIAL_BUILD_CHECK_ATTEMPTS): Promise<PublishedBuildInfo | null> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const buildInfo = await fetchLatestPublishedBuildInfo();
    if (buildInfo?.signature) return buildInfo;
    await wait(Math.min(BUILD_RETRY_DELAY_MS * (attempt + 1), 5_000));
  }

  return null;
};

const unregisterLegacyCaches = async () => {
  let touchedCacheLayer = false;

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    if (registrations?.length) {
      touchedCacheLayer = true;
      await Promise.all(
        registrations.map(async (registration) => {
          try {
            await registration.update();
          } catch {
            // ignore update errors
          }

          return registration.unregister().catch(() => false);
        }),
      );
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      if (cacheKeys.length) {
        touchedCacheLayer = true;
        await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey).catch(() => false)));
      }
    }
  } catch {
    // ignore cleanup errors
  }

  return touchedCacheLayer;
};

const resetStaleClientState = async () => {
  clearClientUiState();
  await clearStaleIndexedDb();
};

const getRequestedBuildSignature = () => {
  try {
    return new URL(window.location.href).searchParams.get(BUILD_SYNC_PARAM);
  } catch {
    return null;
  }
};

const pruneBuildSyncParams = (currentSignature: string) => {
  try {
    const currentUrl = new URL(window.location.href);
    const requestedSignature = currentUrl.searchParams.get(BUILD_SYNC_PARAM);
    if (requestedSignature !== currentSignature) return;

    currentUrl.searchParams.delete(BUILD_SYNC_PARAM);
    currentUrl.searchParams.delete("__ts");
    window.history.replaceState({}, document.title, currentUrl.toString());
  } catch {
    // ignore url rewrite errors
  }
};

const readTargetBuildSignature = () => {
  try {
    return window.localStorage.getItem(TARGET_BUILD_STORAGE_KEY);
  } catch {
    return null;
  }
};

const shouldForceTargetSync = (targetSignature: string, currentSignature: string) => {
  return Boolean(targetSignature && targetSignature !== currentSignature);
};

const waitForPublishedBuildAtLeast = async (expectedSignature: string | null, attempts = INITIAL_BUILD_CHECK_ATTEMPTS) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const buildInfo = await fetchLatestPublishedBuildInfo();
    const signature = buildInfo?.signature ?? null;

    if (isSignatureAtLeast(signature, expectedSignature)) {
      rememberNewestBuildSignature(signature);
      return buildInfo;
    }

    await wait(Math.min(BUILD_RETRY_DELAY_MS * (attempt + 1), 5_000));
  }

  return null;
};

export const initializeBuildSync = async (mountApp: () => void) => {
  if (!isPreviewContext) {
    showBuildSyncStatus("Atualizando MegaBudget…");
  }

  const buildChanged = syncPublishedBuild();
  const cacheLayerWasReset = await withTimeout(unregisterLegacyCaches(), BUILD_FETCH_TIMEOUT_MS, false);
  const currentBuildInfo = getCurrentBuildInfo();
  const currentSignature = currentBuildInfo.signature;
  const currentComparableSignature = getComparableBuildSignature(currentBuildInfo);
  const requestedBuildSignature = getRequestedBuildSignature();
  const persistedTargetSignature = readTargetBuildSignature();
  const expectedBuildSignature = requestedBuildSignature ?? persistedTargetSignature;

  if (!isPreviewContext && currentSignature && expectedBuildSignature) {
    if (shouldForceTargetSync(expectedBuildSignature, currentSignature)) {
      await resetStaleClientState();
      if (forceRefreshToLatestBuild(expectedBuildSignature)) return;
    }

    if (expectedBuildSignature === currentSignature) {
      clearReloadAttemptsForTarget(expectedBuildSignature);
      pruneBuildSyncParams(currentSignature);
    }
  }

  if (!isPreviewContext && currentSignature && (buildChanged || cacheLayerWasReset)) {
    if (shouldForceTargetSync(currentSignature, "")) {
      await resetStaleClientState();
      if (forceRefreshToLatestBuild(currentSignature)) return;
    }
  }

  if (!isPreviewContext) {
    const checkForFreshPublishedBuild = async () => {
      const runtimeBuildInfo = getCurrentBuildInfo();
      const runtimeSignature = runtimeBuildInfo.signature;
      const runtimeComparableSignature = getComparableBuildSignature(runtimeBuildInfo);
      const latestPublishedBuild = await fetchLatestPublishedBuildInfoWithRetry();
      const latestSignature = latestPublishedBuild?.signature ?? null;
      const latestComparableSignature = latestPublishedBuild ? getComparableBuildSignature(latestPublishedBuild) : null;

      if (!runtimeSignature || !latestSignature || latestComparableSignature === runtimeComparableSignature) {
        if (runtimeSignature) clearReloadAttemptsForTarget(runtimeSignature);
        return;
      }

      rememberNewestBuildSignature(latestSignature);

      if (!shouldForceTargetSync(latestSignature, runtimeSignature)) return;

      await resetStaleClientState();
      forceRefreshToLatestBuild(latestSignature);
    };

    const storedNewestSignature = readTargetBuildSignature() ?? (() => {
      try {
        return window.localStorage.getItem(BUILD_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    const latestPublishedBuild = await waitForPublishedBuildAtLeast(storedNewestSignature);
    const latestSignature = latestPublishedBuild?.signature ?? null;
    const latestComparableSignature = latestPublishedBuild ? getComparableBuildSignature(latestPublishedBuild) : null;
    if (currentSignature && latestSignature && latestComparableSignature !== currentComparableSignature) {
      await resetStaleClientState();
      if (forceRefreshToLatestBuild(latestSignature)) return;
    }

    const intervalId = window.setInterval(checkForFreshPublishedBuild, BUILD_CHECK_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForFreshPublishedBuild();
    };

    window.addEventListener("focus", checkForFreshPublishedBuild);
    window.addEventListener("online", checkForFreshPublishedBuild);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void checkForFreshPublishedBuild();

    window.addEventListener("beforeunload", () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForFreshPublishedBuild);
      window.removeEventListener("online", checkForFreshPublishedBuild);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    });
  }

  hideBuildSyncStatus();
  mountApp();
};
