const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID ?? "development";
const BUILD_META_SELECTOR = 'meta[name="app-build-id"]';
const ENTRY_SCRIPT_SELECTOR = 'script[type="module"][src]';

const resolveUrl = (value: string | null) => {
  if (!value || typeof window === "undefined") return null;

  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return value;
  }
};

export const getRuntimeBuildId = () => {
  if (typeof document === "undefined") return APP_BUILD_ID;

  return document.querySelector(BUILD_META_SELECTOR)?.getAttribute("content") ?? APP_BUILD_ID;
};

export const getCurrentEntryScriptUrl = () => {
  if (typeof document === "undefined") return null;

  return resolveUrl(document.querySelector(ENTRY_SCRIPT_SELECTOR)?.getAttribute("src") ?? null);
};

export const getBuildAssetHash = (entryScript = getCurrentEntryScriptUrl()) => {
  if (!entryScript) return null;

  try {
    const fileName = new URL(entryScript).pathname.split("/").pop() ?? "";
    const hashMatch = fileName.match(/-([a-z0-9]{6,})\./i);
    if (hashMatch) return hashMatch[1].slice(0, 8);

    return fileName ? fileName.slice(0, 8) : null;
  } catch {
    const hashMatch = entryScript.match(/-([a-z0-9]{6,})\./i);
    return hashMatch?.[1]?.slice(0, 8) ?? null;
  }
};

export const getCurrentBuildSignature = () => {
  return [getRuntimeBuildId(), getCurrentEntryScriptUrl()].filter(Boolean).join("|");
};

export const getCurrentBuildInfo = () => {
  const buildId = getRuntimeBuildId();
  const entryScript = getCurrentEntryScriptUrl();
  const assetHash = getBuildAssetHash(entryScript);

  return {
    buildId,
    entryScript,
    assetHash,
    signature: [buildId, entryScript].filter(Boolean).join("|"),
  };
};
