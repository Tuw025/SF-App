import { openDB } from 'idb';

console.log("SF Extension Background Worker Started!");

const BLOCKLIST = [
  'localhost',
  '127.0.0.1',
  'bank',
  'paypal',
  'stripe',
  'intranet'
];

function isBlocked(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return BLOCKLIST.some(blocked => hostname.includes(blocked));
  } catch {
    return false;
  }
}

// const API_BASE_URL = 'http://localhost:3000'; // Dùng khi test Local
const API_BASE_URL = 'https://sf-app-sf-web.vercel.app'; // Dùng khi Deploy

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const url = sender.tab?.url || '';
  
  if (isBlocked(url)) {
    sendResponse({ status: "error", message: "Trang web này nằm trong Blocklist." });
    return true;
  }

  if (request.type === 'TRANSLATE_WORD') {
    fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...request.payload,
        domain: new URL(url).hostname,
        contextUrl: url,
      })
    })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ status: "error", message: err.message }));
    
    return true;
  }

  if (request.type === 'SAVE_WORD') {
    fetch(`${API_BASE_URL}/api/words`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Kèm Cookie NextAuth Session
      body: JSON.stringify({
        ...request.payload,
        domain: new URL(url).hostname,
        contextUrl: url,
      })
    })
    .then(res => {
      if (res.status === 401) {
        throw new Error(`Vui lòng đăng nhập tại ${API_BASE_URL} trước`);
      }
      return res.json();
    })
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ status: "error", message: err.message }));
    
    return true;
  }
});
