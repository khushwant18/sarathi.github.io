// API Configuration
const API_BASE_URL = 'https://c64fe879a391.ngrok-free.app/api';

// Auth State
let authToken = null;
let currentUser = null;

// DOM Elements - Auth
const authPage = document.getElementById('authPage');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchBtn = document.getElementById('authSwitchBtn');
const authSwitchText = document.getElementById('authSwitchText');
const nameField = document.getElementById('nameField');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const authSuccess = document.getElementById('authSuccess');
const userInfoContainer = document.getElementById('userInfoContainer');
const userName = document.getElementById('userName');
const logoutButton = document.getElementById('logoutButton');

// DOM Elements - Pages
const classSelectionPage = document.getElementById('classSelectionPage');
const assistantPage = document.getElementById('assistantPage');
const breadcrumb = document.getElementById('breadcrumb');
const breadcrumbText = document.getElementById('breadcrumbText');

// DOM Elements - Controls
const voiceButton = document.getElementById('voiceButton');
const buttonText = document.getElementById('buttonText');
const status = document.getElementById('status');
const announcer = document.getElementById('announcer');
const clearChatButton = document.getElementById('clearChatButton');
const newChatButton = document.getElementById('newChatButton');

// DOM Elements - Chat
const chatHistory = document.getElementById('chatHistory');
const conversationCount = document.getElementById('conversationCount');
const chatSessionsSidebar = document.getElementById('chatSessionsSidebar');
const audioEl = document.getElementById('audio');
const speechRateSlider = document.getElementById('speechRate');
const rateValue = document.getElementById('rateValue');
const textInput = document.getElementById('textInput');
const textSubmit = document.getElementById('textSubmit');

// State
let isLoginMode = true;
let chatMessages = [];
let allChatSessions = [];
let currentSessionId = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = new AudioContext();
let isProcessing = false;
let currentResponse = '';
let selectedBookJSON = null;
let audioQueue = [];
let isPlayingQueue = false;

// ============================================
// AUTH FUNCTIONS
// ============================================

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
  authSuccess.classList.add('hidden');
  announcer.textContent = `Error: ${message}`;
}

function showAuthSuccess(message) {
  authSuccess.textContent = message;
  authSuccess.classList.remove('hidden');
  authError.classList.add('hidden');
  announcer.textContent = message;
}

function hideAuthMessages() {
  authError.classList.add('hidden');
  authSuccess.classList.add('hidden');
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  
  if (isLoginMode) {
    authTitle.textContent = 'Login to Vidya Assist';
    authSubmitBtn.textContent = 'LOGIN';
    authSwitchText.textContent = "Don't have an account?";
    authSwitchBtn.textContent = 'Register here';
    nameField.classList.add('hidden');
    nameInput.required = false;
  } else {
    authTitle.textContent = 'Register for Vidya Assist';
    authSubmitBtn.textContent = 'REGISTER';
    authSwitchText.textContent = 'Already have an account?';
    authSwitchBtn.textContent = 'Login here';
    nameField.classList.remove('hidden');
    nameInput.required = true;
  }
  
  hideAuthMessages();
  authForm.reset();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  hideAuthMessages();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();
  
  if (!email || !password) {
    showAuthError('Please fill in all required fields');
    return;
  }
  
  if (!isLoginMode && !name) {
    showAuthError('Please enter your name');
    return;
  }
  
  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = isLoginMode ? 'LOGGING IN...' : 'REGISTERING...';
  
  try {
    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    const body = isLoginMode 
      ? { email, password }
      : { email, password, name };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      showAuthSuccess(data.message);
      
      // Navigate to class selection after brief delay
      setTimeout(() => {
        showClassSelectionPage();
      }, 1000);
      
    } else {
      showAuthError(data.message);
    }
    
  } catch (err) {
    console.error('Auth error:', err);
    showAuthError('Connection error. Please check your internet connection.');
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isLoginMode ? 'LOGIN' : 'REGISTER';
  }
}

async function verifyAuth() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('currentUser');
  
  if (!token || !user) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      authToken = token;
      currentUser = data.user;
      return true;
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      return false;
    }
    
  } catch (err) {
    console.error('Auth verification error:', err);
    return false;
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  } catch (err) {
    console.error('Logout error:', err);
  }
  
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  
  // Reset state
  chatMessages = [];
  allChatSessions = [];
  currentSessionId = null;
  selectedBookJSON = null;
  
  // Show auth page
  assistantPage.classList.remove('active');
  classSelectionPage.classList.remove('active');
  authPage.classList.add('active');
  breadcrumb.classList.add('hidden');
  userInfoContainer.classList.add('hidden');
  
  announceStatus('Logged out successfully', true);
}

// ============================================
// PAGE NAVIGATION
// ============================================

function showClassSelectionPage() {
  authPage.classList.remove('active');
  assistantPage.classList.remove('active');
  classSelectionPage.classList.add('active');
  breadcrumb.classList.add('hidden');
  
  // Update user info
  if (currentUser) {
    userName.textContent = `Welcome, ${currentUser.name}!`;
    userInfoContainer.classList.remove('hidden');
  }
}

async function showAssistantPage(bookJSON, bookTitle) {
  selectedBookJSON = bookJSON;
  classSelectionPage.classList.remove('active');
  assistantPage.classList.add('active');
  breadcrumb.classList.remove('hidden');
  breadcrumbText.textContent = `Home → ${bookTitle}`;
  
  await initModels();
  await loadChatSessions();
}

// ============================================
// CHAT SESSION FUNCTIONS
// ============================================

async function loadChatSessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      allChatSessions = data.sessions.filter(s => s.book === selectedBookJSON);
      renderChatSessions();
      
      // Load most recent session if available
      if (allChatSessions.length > 0 && !currentSessionId) {
        await loadChatSession(allChatSessions[0].id);
      }
    }
    
  } catch (err) {
    console.error('Error loading chat sessions:', err);
  }
}

function renderChatSessions() {
  if (allChatSessions.length === 0) {
    chatSessionsSidebar.innerHTML = '<div class="no-sessions">No chat sessions yet. Click "NEW CHAT" to start!</div>';
    return;
  }
  
  chatSessionsSidebar.innerHTML = '';
  
  allChatSessions.forEach((session, index) => {
    const sessionDiv = document.createElement('div');
    sessionDiv.className = `chat-session-item ${session.id === currentSessionId ? 'active' : ''}`;
    sessionDiv.setAttribute('tabindex', '0');
    sessionDiv.setAttribute('role', 'button');
    sessionDiv.setAttribute('aria-label', `Chat session: ${session.title}. ${session.message_count} messages. Click to load.`);
    
    if (session.id === currentSessionId) {
      sessionDiv.setAttribute('aria-current', 'true');
    }
    
    const title = document.createElement('div');
    title.className = 'chat-session-title';
    title.textContent = session.title;
    title.setAttribute('aria-hidden', 'true');
    
    const meta = document.createElement('div');
    meta.className = 'chat-session-meta';
    const date = new Date(session.last_message_at || session.created_at);
    meta.textContent = `${session.message_count} messages • ${date.toLocaleDateString()}`;
    meta.setAttribute('aria-hidden', 'true');
    
    sessionDiv.appendChild(title);
    sessionDiv.appendChild(meta);
    
    sessionDiv.addEventListener('click', () => loadChatSession(session.id));
    sessionDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        loadChatSession(session.id);
      }
    });
    
    chatSessionsSidebar.appendChild(sessionDiv);
  });
}

async function loadChatSession(sessionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/session/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    
    console.log('📥 Loaded session data:', data); // ADD THIS
    console.log('📝 Messages:', data.session?.messages); // ADD THIS
    
    if (data.status === 'success') {
      currentSessionId = sessionId;
      
      // Clear current chat
      const welcomeMsg = chatHistory.querySelector('.welcome-chat-message');
      chatHistory.innerHTML = '';
      if (welcomeMsg) chatHistory.appendChild(welcomeMsg);
      
      chatMessages = data.session.messages || [];
      
      console.log('💬 Chat messages array:', chatMessages); // ADD THIS
      
      // Render messages
      chatMessages.forEach(msg => {
        console.log('➡️ Rendering message:', msg); // ADD THIS
        addChatMessageToDOM(msg.text, msg.is_user, msg.source, false);
      });

async function createNewChatSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        book: selectedBookJSON
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      currentSessionId = data.session.id;
      
      // Clear chat
      const welcomeMsg = chatHistory.querySelector('.welcome-chat-message');
      chatHistory.innerHTML = '';
      if (welcomeMsg) chatHistory.appendChild(welcomeMsg);
      
      chatMessages = [];  // ✅ This is correct - you ARE clearing the array
      updateConversationCount();
      
      // Reload sessions
      await loadChatSessions();
      
      announceStatus('New chat session started', true);
    }
    
  } catch (err) {
    console.error('Error creating chat session:', err);
    announceStatus('Error creating new chat', true);
  }
}

async function saveChatMessage(text, isUser, source = null) {
  if (!currentSessionId) {
    await createNewChatSession();
  }
  
  try {
    await fetch(`${API_BASE_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: currentSessionId,
        text: text,
        is_user: isUser,
        source: source
      })
    });
    
    // Refresh sessions to update counts
    await loadChatSessions();
    
  } catch (err) {
    console.error('Error saving message:', err);
  }
}

async function clearCurrentChat() {
  if (!currentSessionId) {
    announceStatus('No active chat to clear', true);
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/clear/${currentSessionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      const welcomeMsg = chatHistory.querySelector('.welcome-chat-message');
      chatHistory.innerHTML = '';
      if (welcomeMsg) chatHistory.appendChild(welcomeMsg);
      
      chatMessages = [];
      updateConversationCount();
      
      await loadChatSessions();
      
      announceStatus('Chat cleared successfully', true);
    }
    
  } catch (err) {
    console.error('Error clearing chat:', err);
    announceStatus('Error clearing chat', true);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function updateConversationCount() {
  const count = chatMessages.length;
  conversationCount.textContent = count === 1 ? '1 message' : `${count} messages`;
}

async function announceStatus(message, speak = false) {
  status.textContent = message;
  announcer.textContent = message;
  console.log('📢', message);
  
  if (speak) {
    speakText(message);
  }
}

async function speakText(text) {
  try {
    const sentences = text
      .replace(/(\d+)\.\s*(\d+)/g, '$1DECIMALDOT$2')
      .replace(/(\d+)\.\s+/g, '$1LISTDOT ')
      .match(/[^.!?]+[.!?]+(?=\s|$)/g) || [text];
    
    for (let sentence of sentences) {
      sentence = sentence
        .replace(/DECIMALDOT/g, '.')
        .replace(/LISTDOT/g, '.')
        .trim();
      
      if (sentence.length > 0) {
        await queueSentenceForTTS(sentence);
      }
    }
    
  } catch (err) {
    console.error('TTS error:', err);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = parseFloat(speechRateSlider.value);
    speechSynthesis.speak(utterance);
  }
}

async function queueSentenceForTTS(sentence) {
  try {
    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: sentence
      })
    });
    
    if (!response.ok) {
      throw new Error('TTS request failed');
    }
    
    const audioBlob = await response.blob();
    audioQueue.push({
      blob: audioBlob,
      text: sentence
    });
    
    if (!isPlayingQueue) {
      playAudioQueue();
    }
  } catch (err) {
    console.error('TTS error for sentence:', err);
  }
}

async function playAudioQueue() {
  if (audioQueue.length === 0) {
    isPlayingQueue = false;
    return;
  }
  
  isPlayingQueue = true;
  const audioItem = audioQueue.shift();
  
  const audioURL = URL.createObjectURL(audioItem.blob);
  
  audioEl.src = audioURL;
  audioEl.playbackRate = parseFloat(speechRateSlider.value);
  
  audioEl.onended = () => {
    URL.revokeObjectURL(audioURL);
    playAudioQueue();
  };

  audioEl.onerror = (e) => {
    console.error('Audio element error:', e);
    URL.revokeObjectURL(audioURL);
    playAudioQueue();
  };
  
  try {
    await audioEl.play();
  } catch (e) {
    console.error('Play failed:', e);
    URL.revokeObjectURL(audioURL);
    playAudioQueue();
  }
}

function addChatMessageToDOM(text, isUser, source = null, scrollToView = true) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isUser ? 'chat-message-user' : 'chat-message-assistant'}`;
  messageDiv.setAttribute('tabindex', '0');
  messageDiv.setAttribute('role', 'article');
  
  const labelText = isUser ? `Your question: ${text}` : `Assistant response: ${text}`;
  messageDiv.setAttribute('aria-label', labelText);
  
  const label = document.createElement('div');
  label.className = 'chat-message-label';
  label.textContent = isUser ? '👤 You:' : '🤖 Assistant:';
  label.setAttribute('aria-hidden', 'true');
  
  const messageText = document.createElement('p');
  messageText.className = 'chat-message-text';
  messageText.textContent = text;
  messageText.setAttribute('aria-hidden', 'true');
  
  messageDiv.appendChild(label);
  messageDiv.appendChild(messageText);
  
  if (!isUser && source) {
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'chat-source';
    sourceDiv.textContent = source;
    sourceDiv.setAttribute('aria-hidden', 'true');
    messageDiv.appendChild(sourceDiv);
  }
  
  const timestamp = new Date().toLocaleTimeString();
  const meta = document.createElement('div');
  meta.className = 'chat-message-meta';
  meta.textContent = `Sent at ${timestamp}`;
  meta.setAttribute('aria-hidden', 'true');
  messageDiv.appendChild(meta);
  
  chatHistory.appendChild(messageDiv);
  
  if (scrollToView) {
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

async function addChatMessage(text, isUser, source = null) {
  addChatMessageToDOM(text, isUser, source, true);
  
  chatMessages.push({ text, is_user: isUser, source, timestamp: new Date() });
  updateConversationCount();
  
  // Save to database
  await saveChatMessage(text, isUser, source);
}

// ============================================
// API FUNCTIONS
// ============================================

async function initModels() {
  try {
    announceStatus('Loading models...');
    
    const response = await fetch(`${API_BASE_URL}/init`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        book: selectedBookJSON
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      announceStatus('System ready. Press Space to start voice input or type your question.', false);
      voiceButton.disabled = false;
      textInput.disabled = false;
      textSubmit.disabled = false;
    } else {
      throw new Error(data.message);
    }
    
  } catch (err) {
    console.error('Model loading error:', err);
    announceStatus('Error loading models. Please make sure the backend server is running.');
  }
}

async function transcribeAudio(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const audioData = audioBuffer.getChannelData(0);
  
  const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)));
  
  const response = await fetch(`${API_BASE_URL}/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio: audioBase64,
      sampleRate: audioBuffer.sampleRate
    })
  });
  
  const data = await response.json();
  
  if (data.status === 'success') {
    return data.text;
  } else {
    throw new Error(data.message);
  }
}

async function searchBook(query, topK = 3) {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      topK
    })
  });
  
  return await response.json();
}

async function generateAnswer(query, context, searchResults) {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      context,
      searchResults,
      chatHistory: chatMessages
    })
  });
  
  const data = await response.json();
  
  if (data.status === 'success') {
    return data.response;
  } else {
    throw new Error(data.message);
  }
}

// ============================================
// RECORDING FUNCTIONS
// ============================================

async function startRecording() {
  try {
    announceStatus('Requesting microphone access...', true);
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      audioChunks = [];
      stream.getTracks().forEach(track => track.stop());
      await processAudio(audioBlob);
    };

    mediaRecorder.start(100);
    isRecording = true;
    
    voiceButton.classList.add('listening');
    buttonText.textContent = 'STOP RECORDING';
    voiceButton.setAttribute('aria-label', 'Stop recording. Press Space key');
    announceStatus('Recording started. Speak now.', true);
    
  } catch (err) {
    console.error('Recording error:', err);
    announceStatus('Could not access microphone. Please check permissions.', true);
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    announceStatus('Processing your speech...', true);
  }
}

async function processAudio(audioBlob) {
  if (isProcessing) return;

  try {
    isProcessing = true;
    voiceButton.disabled = true;
    textInput.disabled = true;
    textSubmit.disabled = true;
    announceStatus('Converting speech to text...', true);

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const audioData = audioBuffer.getChannelData(0);
    
    let maxAmplitude = 0;
    for (let i = 0; i < audioData.length; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(audioData[i]));
    }

    if (maxAmplitude < 0.01) {
      announceStatus('Audio too quiet. Please speak louder.', true);
      resetProcessing();
      return;
    }

    const text = await transcribeAudio(audioBlob);

    if (!text || text === '[BLANK_AUDIO]' || text.includes('BLANK') || text === '[INAUDIBLE]') {
      announceStatus('No speech detected. Please try again.', true);
      resetProcessing();
      return;
    }

    await addChatMessage(text, true);
    announceStatus(`You said: ${text}`, true);
    await processText(text);

  } catch (error) {
    console.error('Audio processing error:', error);
    announceStatus('Error processing audio. Please try again.', true);
    resetProcessing();
  }
}

async function processText(text) {
  try {
    announceStatus('Searching the book for relevant information...', true);
    
    const searchResults = await searchBook(text, 3);
    
    if (!searchResults.results || searchResults.results.length === 0) {
      const noResultMessage = 'I could not find relevant information in the book for your question.';
      currentResponse = noResultMessage;
      await addChatMessage(noResultMessage, false);
      speakText(noResultMessage);
      resetProcessing();
      return;
    }
    
    console.log(`📚 Found ${searchResults.results.length} relevant paragraphs`);
    
    const context = searchResults.results
      .filter(r => parseFloat(r.score) > 10)
      .map(r => `From ${r.chapter}, Page ${r.page}, Paragraph ${r.paragraph} (Score: ${r.score}): ${r.text}`)
      .join('\n\n');
    
    const topResult = searchResults.results.length > 0 && parseFloat(searchResults.results[0].score) > 10 
      ? searchResults.results[0] 
      : null;
    
    announceStatus('Generating answer from the book...', true);

    const response = await generateAnswer(text, context, searchResults.results);
    
    currentResponse = response;
    
    if (topResult) {
      const sourceText = `Source: ${topResult.chapter}, Page ${topResult.page}, Paragraph ${topResult.paragraph}`;
      await addChatMessage(response, false, sourceText);
    } else {
      await addChatMessage(response, false);
    }
    
    console.log(`🤖 AI Response: "${response}"`);
    
    speakText(response);
    
    announceStatus('Response complete. Press Space for voice input or type your question.');
    resetProcessing();

  } catch (err) {
    console.error('❌ Error:', err);
    const errorMessage = 'I encountered an error. Please try again.';
    announceStatus(errorMessage, true);
    resetProcessing();
  }
}

function resetProcessing() {
  isProcessing = false;
  voiceButton.disabled = false;
  textInput.disabled = false;
  textSubmit.disabled = false;
  voiceButton.classList.remove('listening');
  buttonText.textContent = 'RECORD (Space)';
  voiceButton.setAttribute('aria-label', 'Start recording. Press Space key');
}

async function handleTextSubmit() {
  const text = textInput.value.trim();
  
  if (!text) {
    announceStatus('Please enter a question.', true);
    return;
  }
  
  if (isProcessing) {
    announceStatus('Please wait for the current question to be processed.', true);
    return;
  }
  
  await addChatMessage(text, true);
  announceStatus(`You asked: ${text}`, true);
  textInput.value = '';
  await processText(text);
}

async function announceHelp() {
  const helpMessage = "Voice Assistant Help. Press Space to record your question. Press Enter to submit text questions. Press Control N for new chat. Press Control Delete to clear chat. Press Escape to return to home. Press Control H for help.";
  announceStatus(helpMessage, true);
}

// ============================================
// EVENT LISTENERS
// ============================================

// Auth events
authForm.addEventListener('submit', handleAuthSubmit);
authSwitchBtn.addEventListener('click', toggleAuthMode);
logoutButton.addEventListener('click', handleLogout);

// Class selection events
document.getElementById('class6Button')?.addEventListener('click', () => {
  showAssistantPage('NCERT6thbook.json', 'Class 6 Science');
});

document.getElementById('class7Button')?.addEventListener('click', () => {
  showAssistantPage('NCERT7thbook.json', 'Class 7 Science');
});

document.getElementById('class9Button')?.addEventListener('click', () => {
  showAssistantPage('NCERT9thbook.json', 'Class 9 Science');
});

document.getElementById('class10Button')?.addEventListener('click', () => {
  showAssistantPage('NCERT10thbook.json', 'Class 10 Science');
});

document.getElementById('backToClassButton')?.addEventListener('click', () => {
  assistantPage.classList.remove('active');
  classSelectionPage.classList.add('active');
  breadcrumb.classList.add('hidden');
  selectedBookJSON = null;
  currentSessionId = null;
});

// Chat control events
newChatButton?.addEventListener('click', createNewChatSession);
clearChatButton?.addEventListener('click', clearCurrentChat);

voiceButton?.addEventListener('click', async () => {
  if (isProcessing) {
    announceStatus('Please wait for processing to complete.', true);
    return;
  }
  
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

textSubmit?.addEventListener('click', handleTextSubmit);

textInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleTextSubmit();
  }
});

speechRateSlider?.addEventListener('input', (e) => {
  const rate = parseFloat(e.target.value);
  rateValue.textContent = rate.toFixed(1);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when in auth forms
  if (authPage.classList.contains('active') && e.target.tagName === 'INPUT') {
    return;
  }
  
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SUMMARY' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    voiceButton?.click();
  }
  else if (e.code === 'KeyN' && e.ctrlKey) {
    e.preventDefault();
    newChatButton?.click();
  }
  else if (e.code === 'KeyR' && e.ctrlKey) {
    e.preventDefault();
    const lastAssistantMessage = chatMessages.filter(m => !m.is_user).pop();
    if (lastAssistantMessage) {
      announceStatus('Repeating last response...', true);
      setTimeout(() => {
        speakText(lastAssistantMessage.text);
      }, 1000);
    } else {
      announceStatus('No response to repeat.', true);
    }
  }
  else if (e.code === 'Delete' && e.ctrlKey) {
    e.preventDefault();
    clearCurrentChat();
  }
  else if (e.code === 'Escape') {
    e.preventDefault();
    if (assistantPage.classList.contains('active')) {
      document.getElementById('backToClassButton')?.click();
    }
  }
  else if (e.code === 'KeyH' && e.ctrlKey) {
    e.preventDefault();
    announceHelp();
  }
});

// Help buttons
document.getElementById('classHelpButton')?.addEventListener('click', () => {
  const helpMsg = "Class selection page. Choose a class to start learning. Press Control H for help anytime.";
  announceStatus(helpMsg, true);
});

document.getElementById('assistantHelpButton')?.addEventListener('click', announceHelp);

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('🚀 Initializing Vidya Assist...');
  
  // Check if user is already authenticated
  const isAuthenticated = await verifyAuth();
  
  if (isAuthenticated) {
    console.log('✅ User authenticated:', currentUser.email);
    showClassSelectionPage();
  } else {
    console.log('🔐 User not authenticated, showing login');
    authPage.classList.add('active');
  }
}

// Start the app
init();
