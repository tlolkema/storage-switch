let entries = [];

document.addEventListener("DOMContentLoaded", () => {
  const itemsTab = document.getElementById("itemsTab");
  const addTab = document.getElementById("addTab");
  const itemsPanel = document.getElementById("itemsPanel");
  const addPanel = document.getElementById("addPanel");

  function switchTab(tab, panel) {
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll("#withItemsPanel .tab-panel")
      .forEach((panel) => panel.classList.remove("active"));

    tab.classList.add("active");
    panel.classList.add("active");
  }

  itemsTab.addEventListener("click", () => switchTab(itemsTab, itemsPanel));
  addTab.addEventListener("click", () => switchTab(addTab, addPanel));

  // Handle both add entry forms
  document
    .getElementById("addEntryForm")
    .addEventListener("submit", handleAddEntry);
  document
    .getElementById("addEntryForm2")
    .addEventListener("submit", handleAddEntry);

  chrome.storage.local.get(["localStorage_entries"], (result) => {
    entries = result.localStorage_entries || [];
    renderEntries();
    verifyLocalStorageEntries();
    updatePanelVisibility();
  });
});

function handleAddEntry(e) {
  e.preventDefault();
  const form = e.target;
  const keyInput = form.querySelector('input[type="text"]');
  const valueInput = form.querySelector('input[type="text"]:last-of-type');

  const key = keyInput.value.trim();
  const value = valueInput.value.trim();

  // Validate that key is not empty after trimming
  if (!key) {
    return;
  }

  const newEntry = {
    key,
    value,
    enabled: true,
  };

  entries.push(newEntry);
  saveEntries();

  keyInput.value = "";
  valueInput.value = "";

  updateLocalStorage(newEntry.key, newEntry.value);

  // Switch to items panel if we have items
  if (entries.length === 1) {
    updatePanelVisibility();
  }
  switchToItemsTab();
}

function updatePanelVisibility() {
  const noItemsPanel = document.getElementById("noItemsPanel");
  const withItemsPanel = document.getElementById("withItemsPanel");
  const itemsTab = document.getElementById("itemsTab");
  const itemsPanel = document.getElementById("itemsPanel");

  if (entries.length === 0) {
    noItemsPanel.classList.add("active");
    withItemsPanel.classList.remove("active");
  } else {
    noItemsPanel.classList.remove("active");
    withItemsPanel.classList.add("active");
    itemsTab.classList.add("active");
    itemsPanel.classList.add("active");
  }
}

function switchToItemsTab() {
  const itemsTab = document.getElementById("itemsTab");
  const itemsPanel = document.getElementById("itemsPanel");

  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll("#withItemsPanel .tab-panel")
    .forEach((panel) => panel.classList.remove("active"));

  itemsTab.classList.add("active");
  itemsPanel.classList.add("active");
}

function renderEntries() {
  const entriesList = document.getElementById("entriesList");
  entriesList.innerHTML = "";

  entries.forEach((entry, index) => {
    const entryDiv = document.createElement("div");
    entryDiv.className = "entry-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entry.enabled;
    checkbox.addEventListener("change", () => toggleEntry(index));

    const label = document.createElement("label");
    label.textContent = `${entry.key}: ${entry.value}`;

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.className = "remove-btn";
    removeButton.setAttribute("aria-label", "Remove entry");
    removeButton.addEventListener("click", () => removeEntry(index));

    entryDiv.appendChild(checkbox);
    entryDiv.appendChild(label);
    entryDiv.appendChild(removeButton);
    entriesList.appendChild(entryDiv);
  });
}

function toggleEntry(index) {
  entries[index].enabled = !entries[index].enabled;
  if (entries[index].enabled) {
    updateLocalStorage(entries[index].key, entries[index].value);
  } else {
    removeFromLocalStorage(entries[index].key);
  }
  saveEntries();
}

function removeEntry(index) {
  removeFromLocalStorage(entries[index].key);
  entries.splice(index, 1);
  saveEntries();
}

function saveEntries() {
  chrome.storage.local.set({ localStorage_entries: entries });
  renderEntries();
  updatePanelVisibility();
}

function updateLocalStorage(key, value) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;

    chrome.scripting
      .executeScript({
        target: { tabId: tabs[0].id },
        func: (key, value) => {
          try {
            localStorage.setItem(key, value);
            return true;
          } catch (error) {
            console.error("Failed to set localStorage:", error);
            return false;
          }
        },
        args: [key, value],
      })
      .then((results) => {
        if (!results[0]?.result) {
          console.error("Failed to update localStorage");
        }
      })
      .catch((error) => {
        console.error("Failed to execute script:", error);
      });
  });
}

function removeFromLocalStorage(key) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;

    chrome.scripting
      .executeScript({
        target: { tabId: tabs[0].id },
        func: (key) => {
          try {
            localStorage.removeItem(key);
            return true;
          } catch (error) {
            console.error("Failed to remove from localStorage:", error);
            return false;
          }
        },
        args: [key],
      })
      .then((results) => {
        if (!results[0]?.result) {
          console.error("Failed to remove from localStorage");
        }
      })
      .catch((error) => {
        console.error("Failed to execute script:", error);
      });
  });
}

// Add a function to verify current localStorage state when popup opens
function verifyLocalStorageEntries() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;

    chrome.scripting
      .executeScript({
        target: { tabId: tabs[0].id },
        func: (entries) => {
          return entries.map((entry) => ({
            key: entry.key,
            exists: localStorage.getItem(entry.key) !== null,
          }));
        },
        args: [entries],
      })
      .then((results) => {
        if (results[0]?.result) {
          const storageState = results[0].result;
          storageState.forEach((state, index) => {
            if (entries[index].enabled !== state.exists) {
              entries[index].enabled = state.exists;
            }
          });
          renderEntries();
        }
      })
      .catch(console.error);
  });
}
