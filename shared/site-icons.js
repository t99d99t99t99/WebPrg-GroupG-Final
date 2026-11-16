import { webUrl } from "./validation.js";

export function siteIconUrlForPage(pageUrl, size = 32) {
    const normalizedPageUrl = webUrl(pageUrl);
    if (!globalThis.chrome?.runtime?.getURL || !normalizedPageUrl) return "";

    const iconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    iconUrl.searchParams.set("pageUrl", normalizedPageUrl.href);
    iconUrl.searchParams.set("size", String(size));
    return iconUrl.href;
}

export function isSiteIconUrl(value) {
    if (typeof value !== "string") return false;
    if (value === "" || webUrl(value)) return true;
    if (!globalThis.chrome?.runtime?.getURL) return false;

    try {
        const expected = new URL(chrome.runtime.getURL("/_favicon/"));
        const iconUrl = new URL(value);
        return (
            iconUrl.origin === expected.origin &&
            iconUrl.pathname === expected.pathname &&
            Boolean(webUrl(iconUrl.searchParams.get("pageUrl"))) &&
            iconUrl.searchParams.get("size") !== null
        );
    } catch {
        return false;
    }
}
