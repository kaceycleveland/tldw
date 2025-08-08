chrome.runtime.onInstalled.addListener(() => {
  console.log('TLDW Extension installed!')
  
  // Enable side panel opening via action button click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})


chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  console.log('Background received message:', message)
  
  if (message.action === 'background-task') {
    sendResponse({ success: true, data: 'Task completed' })
  }
  
  // Handle navigation requests from side panel
  if (message.action === 'navigateToTimestamp' && message.tabId && message.timestamp) {
    console.log('Background forwarding navigation message to tab:', message.tabId)
    
    try {
      // First try to inject the content script if needed
      await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        files: ['content.js']
      }).catch(() => {
        console.log('Content script already injected or failed to inject')
      })
      
      // Now send the message to the content script
      chrome.tabs.sendMessage(message.tabId, {
        action: 'navigateToTimestamp',
        timestamp: message.timestamp
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Background failed to send message to content script:', chrome.runtime.lastError)
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
        } else {
          console.log('Background successfully forwarded message, response:', response)
          sendResponse({ success: true, response })
        }
      })
    } catch (error) {
      console.error('Background error handling navigation:', error)
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
    }
    
    return true // Keep message channel open for async response
  }
  
  return true
})