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
    console.log('Attempting to navigate to timestamp:', timestamp)
    
    // Parse timestamp (e.g., "2:30" or "1:23:45")
    const parts = timestamp.split(':').reverse()
    let seconds = 0
    
    // Convert to total seconds
    for (let i = 0; i < parts.length; i++) {
      seconds += parseInt(parts[i]) * Math.pow(60, i)
    }
    
    console.log('Calculated seconds:', seconds)
    
    // Function to find and navigate to video
    const navigateToVideo = () => {
      // Try multiple selectors for YouTube video
      const videoSelectors = [
        'video',
        '.html5-video-player video',
        '.video-stream',
        '#movie_player video'
      ]
      
      let video: HTMLVideoElement | null = null
      
      for (const selector of videoSelectors) {
        video = document.querySelector(selector) as HTMLVideoElement
        if (video) {
          console.log('Found video element with selector:', selector)
          break
        }
      }
      
      console.log('Found video element:', !!video)
      
      if (video) {
        console.log('Setting video currentTime to:', seconds)
        video.currentTime = seconds
        video.play()
        showNotification(`Jumped to ${timestamp}`, 'success')
        return true
      }
      
      return false
    }
    
    // Try to navigate immediately
    if (!navigateToVideo()) {
      // If video not found, wait a bit and try again
      console.log('Video not found immediately, waiting and retrying...')
      setTimeout(() => {
        if (!navigateToVideo()) {
          console.error('No video element found after retry')
          showNotification('Could not find video player', 'error')
        }
      }, 1000)
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
    
    // Hide loading indicator and show success notification
    hideLoadingIndicator()
    showNotification('Exercise analysis complete! Open side panel to view results.', 'success')
    
    return exercises
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    hideLoadingIndicator()
    showNotification('Error analyzing video. Please check your API key.', 'error')
    throw error
  }
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
    showNotification('Please check the side panel for exercise results', 'info')
    sendResponse({ success: true })
    return false
  }
  
  if (message.action === 'navigateToTimestamp') {
    console.log('Content script received navigateToTimestamp message:', message)
    navigateToTimestamp(message.timestamp)
    sendResponse({ success: true })
    return false
  }
  
  // For unknown actions, don't keep the channel open
  return false
})