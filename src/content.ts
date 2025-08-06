import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

console.log('TLDW Content script loaded!')

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
  
  const colors = {
    info: '#3b82f6',
    success: '#10b981',
    error: '#ef4444'
  }
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 300px;
    word-wrap: break-word;
  `
  
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
  loader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10002;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `
  
  loader.innerHTML = `
    <div style="background: white; padding: 30px 40px; border-radius: 12px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
      <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
      <h3 style="margin: 0 0 10px; color: #1f2937; font-size: 18px; font-weight: 600;">Analyzing Video</h3>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Extracting exercises using AI...</p>
    </div>
  `
  
  // Add CSS animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
  
  document.body.appendChild(loader)
}

// Function to hide loading indicator
function hideLoadingIndicator() {
  const loader = document.getElementById('tldw-loading-indicator')
  if (loader) {
    loader.remove()
  }
}

// Function to call Gemini API
async function extractExercisesFromVideo(apiKey: string, videoInfo: any) {
  try {
    showLoadingIndicator()
    showNotification('Analyzing video for exercises...', 'info')
    
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
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
    
    const response = result.response
    const text = response.text()
    
    // Parse the JSON response
    const exercises = JSON.parse(text)
    
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
  resultsContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #3b82f6;
    border-radius: 12px;
    padding: 20px;
    max-width: 700px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  `
  
  // Create header
  const headerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">
      <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: bold;">Exercise Analysis Results (${exercises.length} exercises found)</h3>
      <button id="tldw-close-results" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 14px;">Close</button>
    </div>
  `
  
  // Create exercises HTML
  let exercisesHTML = ''
  if (exercises.length === 0) {
    exercisesHTML = '<p style="text-align: center; color: #6b7280; font-style: italic;">No exercises found in this video.</p>'
  } else {
    exercisesHTML = exercises.map((exercise) => `
      <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; color: #1f2937; font-size: 16px; font-weight: 600;">${exercise.exerciseName}</h4>
          <span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${exercise.timestamp}</span>
        </div>
        <p style="margin: 0; color: #374151; line-height: 1.5; font-size: 14px;">${exercise.howToPerform}</p>
      </div>
    `).join('')
  }
  
  resultsContainer.innerHTML = headerHTML + '<div>' + exercisesHTML + '</div>'
  
  document.body.appendChild(resultsContainer)
  
  // Add close functionality
  const closeBtn = document.getElementById('tldw-close-results')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resultsContainer.remove()
    })
  }
  
  // Close on outside click
  resultsContainer.addEventListener('click', (e) => {
    if (e.target === resultsContainer) {
      resultsContainer.remove()
    }
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
  
  // For unknown actions, don't keep the channel open
  return false
})