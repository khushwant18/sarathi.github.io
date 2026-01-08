// API Configuration
const API_BASE_URL = 'https://c64fe879a391.ngrok-free.app/api';
// DOM Elements
const classSelectionPage = document.getElementById('classSelectionPage');
const assistantPage = document.getElementById('assistantPage');
const breadcrumb = document.getElementById('breadcrumb');
const breadcrumbText = document.getElementById('breadcrumbText');
const voiceButton = document.getElementById('voiceButton');
const buttonText = document.getElementById('buttonText');
const status = document.getElementById('status');
const announcer = document.getElementById('announcer');
const chatHistory = document.getElementById('chatHistory');
const conversationCount = document.getElementById('conversationCount');
const clearChatButton = document.getElementById('clearChatButton');
const audioEl = document.getElementById('audio');
const speechRateSlider = document.getElementById('speechRate');
const rateValue = document.getElementById('rateValue');
const textInput = document.getElementById('textInput');
const textSubmit = document.getElementById('textSubmit');
let audioQueue = [];
let isPlayingQueue = false;

// State
let chatMessages = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = new AudioContext();
let isProcessing = false;
let currentResponse = '';
let selectedBookJSON = null;

// Initialize page navigation
document.addEventListener('DOMContentLoaded', function() {
  const class6Button = document.getElementById('class6Button');
  const class7Button = document.getElementById('class7Button');
  const class9Button = document.getElementById('class9Button');
  const class10Button = document.getElementById('class10Button');
  const backToClassButton = document.getElementById('backToClassButton');
  
  async function showAssistantPage6() {
    selectedBookJSON = 'NCERT6thbook.json';
    classSelectionPage.classList.remove('active');
    assistantPage.classList.add('active');
    breadcrumb.classList.remove('hidden');
    breadcrumbText.textContent = 'Home → Class 6 Science';
    await initModels();
  }

  
  async function showAssistantPage7() {
    selectedBookJSON = 'NCERT7thbook.json';
    classSelectionPage.classList.remove('active');
    assistantPage.classList.add('active');
    breadcrumb.classList.remove('hidden');
    breadcrumbText.textContent = 'Home → Class 7 Science';
    await initModels();
  }

  async function showAssistantPage9() {
    selectedBookJSON = 'NCERT9thbook.json';
    classSelectionPage.classList.remove('active');
    assistantPage.classList.add('active');
    breadcrumb.classList.remove('hidden');
    breadcrumbText.textContent = 'Home → Class 9 Science';
    await initModels();
  }
  async function showAssistantPage10() {
    selectedBookJSON = 'NCERT10thbook.json';
    classSelectionPage.classList.remove('active');
    assistantPage.classList.add('active');
    breadcrumb.classList.remove('hidden');
    breadcrumbText.textContent = 'Home → Class 10 Science';
    await initModels();
  }
  
  function showClassSelectionPage() {
    assistantPage.classList.remove('active');
    classSelectionPage.classList.add('active');
    breadcrumb.classList.add('hidden');
  }
  
  if (class6Button) class6Button.addEventListener('click', showAssistantPage6);
  if (class7Button) class7Button.addEventListener('click', showAssistantPage7);
  if (class9Button) class9Button.addEventListener('click', showAssistantPage9);
  if (class10Button) class10Button.addEventListener('click', showAssistantPage10);
  if (backToClassButton) backToClassButton.addEventListener('click', showClassSelectionPage);
});

// Utility Functions
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
      .replace(/(\d+)\.\s*(\d+)/g, '$1DECIMALDOT$2') // Protect decimal numbers
      .replace(/(\d+)\.\s+/g, '$1LISTDOT ') // Protect numbered lists
      .match(/[^.!?]+[.!?]+(?=\s|$)/g) || [text];
    
    for (let sentence of sentences) {
      // Restore protected decimals and list numbers
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
  console.log('🎵 playAudioQueue called, queue length:', audioQueue.length);
  
  if (audioQueue.length === 0) {
    isPlayingQueue = false;
    console.log('Queue empty, stopping');
    return;
  }
  
  isPlayingQueue = true;
  const audioItem = audioQueue.shift();
  
  console.log('🔊 Playing audio for:', audioItem.text);
  console.log('Blob size:', audioItem.blob.size, 'bytes');
  console.log('Blob type:', audioItem.blob.type);
  
  const audioURL = URL.createObjectURL(audioItem.blob);
  console.log('Audio URL created:', audioURL);
  
  audioEl.src = audioURL;
  audioEl.playbackRate = parseFloat(speechRateSlider.value);
  
  audioEl.onended = () => {
    console.log('✅ Audio ended');
    URL.revokeObjectURL(audioURL);
    playAudioQueue();
  };

  audioEl.onerror = (e) => {
    console.error('❌ Audio element error:', e);
    console.error('Audio element error details:', audioEl.error);
    URL.revokeObjectURL(audioURL);
    playAudioQueue();
  };
  
  try {
    console.log('Attempting to play...');
    await audioEl.play();
    console.log('✅ Play successful');
  } catch (e) {
    console.error('❌ Play failed:', e);
    URL.revokeObjectURL(audioURL);
    playAudioQueue();
  }
}

async function addChatMessage(text, isUser, source = null) {
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
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
  
  chatMessages.push({ text, isUser, source, timestamp });
  updateConversationCount();
}

async function clearChatHistory() {
  const welcomeMessage = chatHistory.querySelector('.welcome-chat-message');
  chatHistory.innerHTML = '';
  if (welcomeMessage) {
    chatHistory.appendChild(welcomeMessage);
  }
  chatMessages = [];
  updateConversationCount();
  await announceStatus('Chat history cleared.', true);
}

// API Functions
async function initModels() {
  try {
    announceStatus('Loading models...');
    
    const response = await fetch(`${API_BASE_URL}/init`, {
      method: 'POST',
      headers: {
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
  
  // Convert to base64
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

// Recording Functions
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
  const helpMessage = "Voice Assistant Help. Press Space to record your question. Press Enter to submit text questions. Press Control Delete to clear chat history. Press Escape to return to home. Press Control H for help.";
  announceStatus(helpMessage, true);
}

// Event Listeners
voiceButton.addEventListener('click', async () => {
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

clearChatButton.addEventListener('click', clearChatHistory);
textSubmit.addEventListener('click', handleTextSubmit);

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleTextSubmit();
  }
});

speechRateSlider.addEventListener('input', (e) => {
  const rate = parseFloat(e.target.value);
  rateValue.textContent = rate.toFixed(1);
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SUMMARY') {
    e.preventDefault();
    voiceButton.click();
  }
  else if (e.code === 'KeyR' && e.ctrlKey) {
    e.preventDefault();
    const lastAssistantMessage = chatMessages.filter(m => !m.isUser).pop();
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
    clearChatHistory();
  }
  else if (e.code === 'Escape') {
    e.preventDefault();
    document.getElementById('backToClassButton').click();
  }
  else if (e.code === 'KeyH' && e.ctrlKey) {
    e.preventDefault();
    announceHelp();
  }
});
