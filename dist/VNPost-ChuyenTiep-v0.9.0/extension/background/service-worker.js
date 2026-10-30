// VNPost PNS Chuyển Tiếp Hàng Loạt - Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[VNPost Forwarding] Extension installed.');
  // Bật mở side panel khi người dùng nhấp vào biểu tượng extension trên thanh công cụ
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
      console.warn('[VNPost Forwarding] Failed to set side panel behavior:', error);
    });
  }
});

// Lắng nghe khi nhấp vào Action nếu setPanelBehavior không khả dụng
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      console.warn('[VNPost Forwarding] Could not open side panel:', e);
    }
  }
});
