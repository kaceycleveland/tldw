import './style.css'

document.addEventListener('DOMContentLoaded', () => {
  const actionBtn = document.getElementById('action-btn')
  
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      console.log('Extension button clicked!')
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'greet',
            message: 'Hello from popup!'
          })
        }
      })
    })
  }
})