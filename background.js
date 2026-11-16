import { bookmarks } from "./db/db.js";
import { webUrl } from "./shared/validation.js";

async function updateSavedPageIcon(tabUrl, tabIconUrl) {
    const pageUrl = webUrl(tabUrl)?.href;
    const iconUrl = webUrl(tabIconUrl)?.href;
    if (!pageUrl || !iconUrl) return;

    const savedBookmarks = await bookmarks.get();
    for (const bookmark of savedBookmarks) {
        if (webUrl(bookmark.url)?.href !== pageUrl || bookmark.iconUrl === iconUrl) continue;
        await bookmarks.edit(bookmark.id, { iconUrl });
    }
}

function handleTabIcon(tabUrl, tabIconUrl) {
    updateSavedPageIcon(tabUrl, tabIconUrl).catch((error) => console.error(error));
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.favIconUrl !== undefined) {
        handleTabIcon(tab.url, changeInfo.favIconUrl);
    }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) return;
        handleTabIcon(tab.url, tab.favIconUrl);
    });
});
