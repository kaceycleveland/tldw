import './style.css'

document.addEventListener('DOMContentLoaded', () => {
  const enabledState = document.getElementById('enabled-state')
  const disabledState = document.getElementById('disabled-state')
  const extractBtn = document.getElementById('extract-btn')
  const viewResultsBtn = document.getElementById('view-results-btn')
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement
  const saveKeyBtn = document.getElementById('save-key-btn')
  
  // Load saved API key
  chrome.storage.sync.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey && apiKeyInput) {
      apiKeyInput.value = result.geminiApiKey
    }
  })
  
  // Save API key
  if (saveKeyBtn && apiKeyInput) {
    saveKeyBtn.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim()
      if (apiKey) {
        chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
          console.log('API key saved')
          // Visual feedback
          saveKeyBtn.textContent = 'Saved!'
          setTimeout(() => {
            saveKeyBtn.textContent = 'Save Key'
          }, 2000)
        })
      }
    })
  }
  
  // Check if current tab is a YouTube video
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0]
    const isYouTubeVideo = currentTab?.url?.includes('youtube.com/watch')
    
    if (isYouTubeVideo) {
      enabledState?.classList.remove('hidden')
      disabledState?.classList.add('hidden')
    } else {
      enabledState?.classList.add('hidden')
      disabledState?.classList.remove('hidden')
    }
  })
  
  // Handle extract button click
  if (extractBtn) {
    extractBtn.addEventListener('click', () => {
      console.log('Extract exercises button clicked!')
      
      // Get API key first
      chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (!result.geminiApiKey) {
          alert('Please enter your Gemini API key first')
          return
        }
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'extractExercises',
              message: 'Extract exercises from video',
              apiKey: result.geminiApiKey
            })
          }
        })
      })
    })
  }
  
  // Handle view results button click
  if (viewResultsBtn) {
    viewResultsBtn.addEventListener('click', () => {
      console.log('View results button clicked!')
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'showLastResults',
            message: 'Show last exercise results'
          })
        }
      })
    })
  }
})