// ============================
// background.js
// ============================

const BLOCK_KEY = "qsr-blocked-sites";

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "qsr-block-site",
        title: "Block Screen Recorder on This Site",
        contexts: ["page"]
    });

    chrome.contextMenus.create({
        id: "qsr-restore-site",
        title: "Restore Screen Recorder on This Site",
        contexts: ["page"]
    });
});


// Handle click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {

    if (!tab?.url) return;

    const url = new URL(tab.url);
    const host = url.origin;

    const data = await chrome.storage.local.get([BLOCK_KEY]);
    const blocked = data[BLOCK_KEY] || [];

    // BLOCK SITE
    if (info.menuItemId === "qsr-block-site") {

        if (!blocked.includes(host)) {
            blocked.push(host);
            await chrome.storage.local.set({ [BLOCK_KEY]: blocked });
            chrome.tabs.sendMessage(tab.id, {
                type: "QSR_TOAST",
                message: `🚫 Recorder blocked on ${host}`
            });
            setTimeout(() => {
                chrome.tabs.reload(tab.id);
            }, 800);
        }

    }

    // RESTORE SITE
    if (info.menuItemId === "qsr-restore-site") {

        const updated = blocked.filter(s => s !== host);

        await chrome.storage.local.set({ [BLOCK_KEY]: updated }); chrome.tabs.sendMessage(tab.id, {
            type: "QSR_TOAST",
            message: `✅ Recorder restored on ${host}`
        });
        setTimeout(() => {
            chrome.tabs.reload(tab.id);
        }, 800);

    }

});