import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

console.log('TLDW Content script loaded!')

// Request background script to inject CSS styles
chrome.runtime.sendMessage({ action: 'injectContentStyles' })

// Function to extract video information
function getVideoInfo() {
  const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'Unknown video'
  const description = document.querySelector('#description-text')?.textContent || ''
  const videoId = new URLSearchParams(window.location.search).get('v')
  
  return {
    title,
    description,
    videoId,
    url: window.location.href
  }
}

// Function to show notification
function showNotification(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const notification = document.createElement('div')
  notification.textContent = message
  
  const typeClasses = {
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    error: 'bg-red-500'
  }
  
  notification.className = `fixed top-5 right-5 ${typeClasses[type]} text-white px-4 py-3 rounded-lg z-[10000] font-sans shadow-lg max-w-xs break-words`
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.remove()
  }, 5000)
}

// Function to show loading indicator
function showLoadingIndicator() {
  // Remove any existing loading indicator
  const existingLoader = document.getElementById('tldw-loading-indicator')
  if (existingLoader) {
    existingLoader.remove()
  }
  
  const loader = document.createElement('div')
  loader.id = 'tldw-loading-indicator'
  loader.className = 'fixed bottom-5 right-5 bg-white p-4 rounded-lg shadow-lg flex items-center z-[10002] font-sans'
  
  loader.innerHTML = `
    <div class="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mr-3"></div>
    <div>
      <h3 class="m-0 text-gray-800 text-sm font-semibold">Analyzing Video...</h3>
    </div>
  `
  
  document.body.appendChild(loader)
}

// Function to hide loading indicator
function hideLoadingIndicator() {
  const loader = document.getElementById('tldw-loading-indicator')
  if (loader) {
    loader.remove()
  }
}

// Function to navigate to timestamp in YouTube video
function navigateToTimestamp(timestamp: string) {
  try {
    // Parse timestamp (e.g., "2:30" or "1:23:45")
    const parts = timestamp.split(':').reverse()
    let seconds = 0
    
    // Convert to total seconds
    for (let i = 0; i < parts.length; i++) {
      seconds += parseInt(parts[i]) * Math.pow(60, i)
    }
    
    // Get YouTube video player
    const video = document.querySelector('video') as HTMLVideoElement
    if (video) {
      video.currentTime = seconds
      video.play()
      showNotification(`Jumped to ${timestamp}`, 'success')
    } else {
      showNotification('Could not find video player', 'error')
    }
  } catch (error) {
    console.error('Error navigating to timestamp:', error)
    showNotification('Invalid timestamp format', 'error')
  }
}

// Function to call Gemini API
async function extractExercisesFromVideo(apiKey: string, videoInfo: any) {
  try {
    showLoadingIndicator()
    showNotification('Analyzing video for exercises...', 'info')
    
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              exerciseName: {
                type: SchemaType.STRING,
                description: "The name of the exercise"
              },
              timestamp: {
                type: SchemaType.STRING,
                description: "The timestamp when the exercise appears in the video (e.g., '2:30' or 'N/A' if not available)"
              },
              howToPerform: {
                type: SchemaType.STRING,
                description: "A detailed summary of how to perform the exercise including form cues, sets, reps, duration, and equipment needed"
              }
            },
            required: ["exerciseName", "timestamp", "howToPerform"]
          }
        }
      }
    })
    
    const prompt = `Please analyze this YouTube video and extract any exercises, workouts, or physical activities shown or demonstrated.

For each exercise you identify, provide:
- The exact name of the exercise
- The timestamp when it appears in the video (if visible)
- A comprehensive summary of how to perform it including form cues, sets/reps if mentioned, duration, and any equipment needed

If no exercises are found in the video, return an empty array.

Video Title: ${videoInfo.title}
Video Description: ${videoInfo.description}`
    
    console.log('video info', videoInfo)
    
    const result = await model.generateContent([
      prompt,
      {
        // @ts-expect-error youtube video does not require mime
        fileData: {
          fileUri: videoInfo.url,
        },
      },
    ])

    console.log('result', result.response);

    console.log('metadata', result.response.usageMetadata)
    
    const response = result.response
    const text = response.text()
    
    // Parse the JSON response
    const exercises = JSON.parse(text)
    
    console.log('exercises', exercises)
    
    // Store results for later viewing
    chrome.storage.local.set({ 
      lastExerciseResults: exercises,
      lastVideoUrl: videoInfo.url,
      lastVideoTitle: videoInfo.title
    })
    
    // Hide loading indicator and display results
    hideLoadingIndicator()
    displayExerciseResults(exercises)
    showNotification('Exercise analysis complete!', 'success')
    
    return exercises
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    hideLoadingIndicator()
    showNotification('Error analyzing video. Please check your API key.', 'error')
    throw error
  }
}

// Function to display exercise results
function displayExerciseResults(exercises: any[]) {
  // Remove any existing results
  const existingResults = document.getElementById('tldw-exercise-results')
  if (existingResults) {
    existingResults.remove()
  }
  
  const resultsContainer = document.createElement('div')
  resultsContainer.id = 'tldw-exercise-results'
  resultsContainer.className = 'fixed bottom-5 right-5 bg-white border-2 border-blue-500 rounded-xl p-5 w-[450px] max-h-[60vh] overflow-y-auto z-[10001] font-sans shadow-2xl flex flex-col'

  let isExpanded = false
  
  // Create header
  const header = document.createElement('div')
  header.className = 'flex justify-between items-center pb-3'

  header.innerHTML = `
    <h3 class="m-0 text-gray-800 text-lg font-bold">Exercise Analysis Results (${exercises.length} found)</h3>
    <div class="flex items-center">
      <button id="tldw-toggle-results" class="bg-gray-200 text-gray-800 border-none rounded-md px-3 py-1.5 cursor-pointer text-sm hover:bg-gray-300 mr-2">Expand</button>
      <button id="tldw-close-results" class="bg-red-500 text-white border-none rounded-md px-3 py-1.5 cursor-pointer text-sm hover:bg-red-600">Close</button>
    </div>
  `
  
  // Create exercises container
  const exercisesContainer = document.createElement('div')
  exercisesContainer.className = 'overflow-y-auto'
  exercisesContainer.style.display = 'none' // Initially hidden

  if (exercises.length === 0) {
    exercisesContainer.innerHTML = '<p class="text-center text-gray-500 italic">No exercises found in this video.</p>'
  } else {
    exercisesContainer.innerHTML = exercises.map((exercise) => {
      const isClickableTimestamp = exercise.timestamp !== 'N/A' && exercise.timestamp.match(/^\d+:\d+$|^\d+:\d+:\d+$/)
      const timestampElement = isClickableTimestamp 
        ? `<button class="timestamp-btn bg-blue-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors hover:bg-blue-600" data-timestamp="${exercise.timestamp}">${exercise.timestamp}</button>`
        : `<span class="bg-gray-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium">${exercise.timestamp}</span>`
      
      return `
        <div class="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <div class="flex justify-between items-start mb-1.5">
            <h4 class="m-0 text-gray-800 text-base font-semibold">${exercise.exerciseName}</h4>
            ${timestampElement}
          </div>
          <p class="m-0 text-gray-700 leading-relaxed text-sm">${exercise.howToPerform}</p>
        </div>
      `
    }).join('')
  }
  
  resultsContainer.appendChild(header)
  resultsContainer.appendChild(exercisesContainer)
  document.body.appendChild(resultsContainer)
  
  // --- Functionality ---

  // Toggle expand/collapse
  const toggleBtn = document.getElementById('tldw-toggle-results')
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isExpanded = !isExpanded
      exercisesContainer.style.display = isExpanded ? 'block' : 'none'
      toggleBtn.textContent = isExpanded ? 'Collapse' : 'Expand'
      resultsContainer.classList.toggle('is-expanded', isExpanded)

      // Adjust styles for expanded view
      if (isExpanded) {
        resultsContainer.style.borderTopWidth = '1px'
        header.style.borderBottom = '1px solid #e5e7eb' // border-gray-200
        header.style.marginBottom = '0.75rem' // mb-3
      } else {
        header.style.borderBottom = 'none'
        header.style.marginBottom = '0'
      }
    })
  }

  // Add close functionality
  const closeBtn = document.getElementById('tldw-close-results')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resultsContainer.remove()
    })
  }
  
  // Add timestamp click handlers
  const timestampBtns = resultsContainer.querySelectorAll('.timestamp-btn')
  timestampBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const timestamp = (e.target as HTMLElement).getAttribute('data-timestamp')
      if (timestamp) {
        navigateToTimestamp(timestamp)
      }
    })
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message)
  
  if (message.action === 'greet') {
    showNotification(`Extension says: ${message.message}`)
    sendResponse({ success: true })
    return false // Synchronous response, close channel
  }
  
  if (message.action === 'extractExercises') {
    console.log('Extract starting')
    const videoInfo = getVideoInfo()
    console.log('Video info:', videoInfo)
    
    extractExercisesFromVideo(message.apiKey, videoInfo)
      .then((result) => {
        sendResponse({ success: true, exercises: result })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    
    return true // Keep message channel open for async response
  }
  
  if (message.action === 'showLastResults') {
    chrome.storage.local.get(['lastExerciseResults', 'lastVideoUrl', 'lastVideoTitle'], (result) => {
      console.log(result);
      if (result.lastExerciseResults && result.lastVideoUrl === window.location.href) {
        displayExerciseResults(result.lastExerciseResults)
        sendResponse({ success: true })
      } else {
        showNotification('No exercise results found for this video', 'info')
        sendResponse({ success: false, message: 'No results found' })
      }
    })
    return true
  }
  
  // For unknown actions, don't keep the channel open
  return false
})