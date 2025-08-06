chrome.runtime.onInstalled.addListener(() => {
  console.log('TLDW Extension installed!')
})

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('Background received message:', message)
  
  if (message.action === 'background-task') {
    sendResponse({ success: true, data: 'Task completed' })
  }
  
  return true
})