import "./style.css";

console.log("TLDW Side panel loaded!");

// Types
interface Exercise {
  exerciseName: string;
  timestamp: string;
  howToPerform: string;
}

// DOM Elements
const enabledState = document.getElementById("enabled-state")!;
const disabledState = document.getElementById("disabled-state")!;
const extractBtn = document.getElementById("extract-btn")!;
const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const saveKeyBtn = document.getElementById("save-key-btn")!;
const loadingState = document.getElementById("loading-state")!;
const noResultsState = document.getElementById("no-results-state")!;
const resultsContainer = document.getElementById("results-container")!;
const videoTitle = document.getElementById("video-title")!;
const exerciseCount = document.getElementById("exercise-count")!;
const exercisesList = document.getElementById("exercises-list")!;
const refreshBtn = document.getElementById("refresh-btn")!;

// State management
let currentTabId: number | undefined;
let currentUrl: string = "";
let isYouTubeVideo: boolean = false;

// Function to show different states
function showState(state: "loading" | "no-results" | "results") {
  loadingState.classList.add("hidden");
  noResultsState.classList.add("hidden");
  resultsContainer.classList.add("hidden");

  switch (state) {
    case "loading":
      loadingState.classList.remove("hidden");
      break;
    case "no-results":
      noResultsState.classList.remove("hidden");
      break;
    case "results":
      resultsContainer.classList.remove("hidden");
      break;
  }
}

// Function to navigate to timestamp in YouTube video
function navigateToTimestamp(timestamp: string) {
  if (!currentTabId) {
    console.error("No current tab ID available for navigation");
    return;
  }

  console.log("Sending navigateToTimestamp message via background:", {
    timestamp,
    currentTabId,
  });

  // Send message to background script, which will forward it to the content script
  chrome.runtime.sendMessage(
    {
      action: "navigateToTimestamp",
      timestamp: timestamp,
      tabId: currentTabId,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Could not send message to background script:",
          chrome.runtime.lastError
        );
      } else if (response && !response.success) {
        console.error("Background script reported error:", response.error);
      } else {
        console.log("Navigation message successful:", response);
      }
    }
  );
}

// Function to display exercise results
function displayExercises(exercises: Exercise[], title: string) {
  videoTitle.textContent = title;
  exerciseCount.textContent = `${exercises.length} exercise${
    exercises.length === 1 ? "" : "s"
  } found`;

  if (exercises.length === 0) {
    exercisesList.innerHTML =
      '<p class="text-center text-gray-500 italic p-4">No exercises found in this video.</p>';
  } else {
    exercisesList.innerHTML = exercises
      .map((exercise) => {
        const isClickableTimestamp =
          exercise.timestamp !== "N/A" &&
          exercise.timestamp.match(/^\d+:\d+$|^\d+:\d+:\d+$/);
        const timestampElement = isClickableTimestamp
          ? `<button class="timestamp-btn bg-blue-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors hover:bg-blue-600" data-timestamp="${exercise.timestamp}">${exercise.timestamp}</button>`
          : `<span class="bg-gray-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium">${exercise.timestamp}</span>`;

        return `
        <div class="p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
          <div class="flex justify-between items-start mb-2">
            <h4 class="m-0 text-gray-800 text-sm font-semibold flex-1 pr-2">${exercise.exerciseName}</h4>
            ${timestampElement}
          </div>
          <p class="m-0 text-gray-700 leading-relaxed text-xs">${exercise.howToPerform}</p>
        </div>
      `;
      })
      .join("");

    // Add timestamp click handlers
    const timestampBtns = exercisesList.querySelectorAll(".timestamp-btn");
    timestampBtns.forEach((btn) => {
      console.log("timestampBtns:", btn);
      btn.addEventListener("click", (e) => {
        const timestamp = (e.target as HTMLElement).getAttribute(
          "data-timestamp"
        );
        if (timestamp) {
          console.log("navigating to timestamp:", timestamp);
          navigateToTimestamp(timestamp);
        }
      });
    });
  }

  showState("results");
}

// Function to load API key
function loadApiKey() {
  chrome.storage.sync.get(["geminiApiKey"], (result) => {
    if (result.geminiApiKey && apiKeyInput) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });
}

// Function to save API key
function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      console.log("API key saved");
      // Visual feedback
      saveKeyBtn.textContent = "Saved!";
      setTimeout(() => {
        saveKeyBtn.textContent = "Save Key";
      }, 2000);
    });
  }
}

// Function to check tab status and update UI
async function updateTabStatus() {
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("Current tab:", tab);

    currentTabId = tab.id;
    currentUrl = tab.url || "";
    isYouTubeVideo = currentUrl.includes("youtube.com/watch");

    console.log("Tab URL:", currentUrl);
    console.log("Tab ID:", currentTabId);
    console.log("Is YouTube video:", isYouTubeVideo);

    // Update UI based on YouTube video status
    if (isYouTubeVideo) {
      console.log("Showing enabled state");
      enabledState.classList.remove("hidden");
      disabledState.classList.add("hidden");
    } else {
      console.log("Showing disabled state");
      enabledState.classList.add("hidden");
      disabledState.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error checking tab status:", error);
    // Show disabled state on error
    enabledState.classList.add("hidden");
    disabledState.classList.remove("hidden");
  }
}

// Function to extract exercises
function extractExercises() {
  console.log("Extract exercises button clicked!");

  // Get API key first
  chrome.storage.sync.get(["geminiApiKey"], (result) => {
    if (!result.geminiApiKey) {
      alert("Please enter your Gemini API key first");
      return;
    }

    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, {
        action: "extractExercises",
        message: "Extract exercises from video",
        apiKey: result.geminiApiKey,
      });
    }
  });
}

// Function to load exercise results
async function loadExerciseResults() {
  try {
    // Update tab status first
    await updateTabStatus();

    // Check if we're on a YouTube video page
    if (!isYouTubeVideo) {
      showState("no-results");
      return;
    }

    showState("loading");

    // Get stored exercise results
    const result = await chrome.storage.local.get([
      "lastExerciseResults",
      "lastVideoUrl",
      "lastVideoTitle",
    ]);

    if (result.lastExerciseResults && result.lastVideoUrl === currentUrl) {
      displayExercises(
        result.lastExerciseResults,
        result.lastVideoTitle || "Unknown Video"
      );
    } else {
      showState("no-results");
    }
  } catch (error) {
    console.error("Error loading exercise results:", error);
    showState("no-results");
  }
}

// Function to handle storage changes
function handleStorageChange(changes: {
  [key: string]: chrome.storage.StorageChange;
}) {
  if (changes.lastExerciseResults && changes.lastVideoUrl) {
    const exerciseResults = changes.lastExerciseResults.newValue;
    const videoUrl = changes.lastVideoUrl.newValue;
    const videoTitle = changes.lastVideoTitle?.newValue || "Unknown Video";

    // Only update if the results are for the current page
    if (videoUrl === currentUrl && exerciseResults) {
      displayExercises(exerciseResults, videoTitle);
    }
  }
}

// Event listeners
// API Key management
saveKeyBtn.addEventListener("click", saveApiKey);

// Extract exercises
extractBtn.addEventListener("click", extractExercises);

// Refresh results
refreshBtn.addEventListener("click", async () => {
  console.log("Refresh button clicked");
  await updateTabStatus();
  await loadExerciseResults();
});

// Listen for storage changes to update results in real-time
chrome.storage.onChanged.addListener(handleStorageChange);

// Listen for tab changes
chrome.tabs.onActivated.addListener(async () => {
  console.log("Tab activated, updating status");
  await updateTabStatus();
  loadExerciseResults();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    console.log("Tab updated:", tabId, changeInfo);
    await updateTabStatus();
    if (tabId === currentTabId) {
      loadExerciseResults();
    }
  }
});

// Initialize everything when the side panel loads
async function initialize() {
  console.log("Initializing side panel...");
  loadApiKey();
  await updateTabStatus();
  await loadExerciseResults();
}

// Initialize
initialize();
