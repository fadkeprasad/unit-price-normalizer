const DEFAULTS = { enabled: true, highlightBest: true, decimals: "smart" };
const enabled = document.querySelector("#enabled");
const highlightBest = document.querySelector("#highlightBest");
const decimals = document.querySelector("#decimals");
const rescan = document.querySelector("#rescan");
const statusTitle = document.querySelector("#statusTitle");
const statusDetail = document.querySelector("#statusDetail");

function showStats(stats) {
  if (!stats) {
    statusTitle.textContent = "No shopping page detected";
    statusDetail.textContent = "Open a product listing, then scan again";
    return;
  }
  statusTitle.textContent = stats.normalized === 1 ? "1 product normalized" : `${stats.normalized} products normalized`;
  statusDetail.textContent = stats.unsupported
    ? `${stats.unsupported} more lacked a recognizable package size`
    : stats.found ? "Every recognized product has a comparable price" : "No product cards found on this page";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(type) {
  try {
    const tab = await activeTab();
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (_error) {
    return null;
  }
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  enabled.checked = stored.enabled;
  highlightBest.checked = stored.highlightBest;
  decimals.value = String(stored.decimals);
});

enabled.addEventListener("change", () => chrome.storage.sync.set({ enabled: enabled.checked }));
highlightBest.addEventListener("change", () => chrome.storage.sync.set({ highlightBest: highlightBest.checked }));
decimals.addEventListener("change", () => chrome.storage.sync.set({ decimals: decimals.value }));

rescan.addEventListener("click", async () => {
  rescan.disabled = true;
  rescan.textContent = "Scanning…";
  showStats(await send("UPN_RESCAN"));
  rescan.disabled = false;
  rescan.textContent = "Scan page again";
});

send("UPN_GET_STATS").then(showStats);
