/**
 * Claude-Style Chat Interface
 */

// Types
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

// State
let currentSession: ChatSession | null = null;
let sessions: ChatSession[] = [];
let isGenerating = false;
let currentModel = 'minimax-2.7';

// API Configuration
const API_BASE = 'https://api.ustc.dev';

// DOM Elements
let welcomeEl: HTMLElement | null;
let messagesEl: HTMLElement | null;
let inputField: HTMLTextAreaElement | null;
let sendBtn: HTMLButtonElement | null;
let sidebarEl: HTMLElement | null;
let modelBtn: HTMLButtonElement | null;
let modelDropdown: HTMLElement | null;
let newChatBtn: HTMLButtonElement | null;
let sidebarToggle: HTMLButtonElement | null;
let chatListEl: HTMLElement | null;

/**
 * Initialize the chat interface
 */
export function initClaudeChat() {
  // Get DOM elements
  welcomeEl = document.getElementById('welcome');
  messagesEl = document.getElementById('messages');
  inputField = document.getElementById('input-field') as HTMLTextAreaElement;
  sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  sidebarEl = document.getElementById('sidebar');
  modelBtn = document.getElementById('model-btn');
  modelDropdown = document.getElementById('model-dropdown');
  newChatBtn = document.getElementById('new-chat-btn');
  sidebarToggle = document.getElementById('sidebar-toggle');
  chatListEl = document.getElementById('chat-list');

  // Load saved sessions
  loadSessions();

  // Setup event listeners
  setupEventListeners();

  // Auto-resize textarea
  if (inputField) {
    inputField.addEventListener('input', autoResizeTextarea);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Send message
  sendBtn?.addEventListener('click', handleSendMessage);
  
  // Enter to send
  inputField?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Enable/disable send button
  inputField?.addEventListener('input', () => {
    if (sendBtn) {
      sendBtn.disabled = !inputField.value.trim();
    }
  });

  // Suggestion cards
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt && inputField) {
        inputField.value = prompt;
        autoResizeTextarea();
        if (sendBtn) sendBtn.disabled = false;
        handleSendMessage();
      }
    });
  });

  // Model selector
  modelBtn?.addEventListener('click', () => {
    modelDropdown?.classList.toggle('visible');
  });

  // Model options
  document.querySelectorAll('.model-option').forEach(option => {
    option.addEventListener('click', () => {
      const model = option.getAttribute('data-model');
      const modelName = option.querySelector('.model-title')?.textContent;
      
      if (model && modelName) {
        currentModel = model;
        const modelNameEl = document.querySelector('.model-name');
        if (modelNameEl) modelNameEl.textContent = modelName;
        
        // Update active state
        document.querySelectorAll('.model-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        
        modelDropdown?.classList.remove('visible');
      }
    });
  });

  // Close model dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!modelBtn?.contains(e.target as Node) && !modelDropdown?.contains(e.target as Node)) {
      modelDropdown?.classList.remove('visible');
    }
  });

  // New chat
  newChatBtn?.addEventListener('click', startNewChat);

  // Toggle sidebar
  sidebarToggle?.addEventListener('click', () => {
    sidebarEl?.classList.toggle('collapsed');
    sidebarEl?.classList.toggle('visible');
  });

  // Sidebar toggle button in footer
  document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
    sidebarEl?.classList.toggle('collapsed');
  });
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
  if (!inputField || !inputField.value.trim() || isGenerating) return;

  const content = inputField.value.trim();
  inputField.value = '';
  autoResizeTextarea();
  if (sendBtn) sendBtn.disabled = true;

  // Create new session if needed
  if (!currentSession) {
    currentSession = {
      id: generateId(),
      title: content.slice(0, 50),
      messages: [],
      createdAt: new Date()
    };
    sessions.unshift(currentSession);
    renderChatList();
  }

  // Hide welcome, show messages
  welcomeEl?.classList.add('hidden');
  messagesEl?.classList.add('active');

  // Add user message
  const userMessage: ChatMessage = {
    role: 'user',
    content,
    timestamp: new Date()
  };
  currentSession.messages.push(userMessage);
  renderMessage(userMessage);

  // Show typing indicator
  showTypingIndicator();

  // Get AI response
  isGenerating = true;
  try {
    const response = await getAIResponse(content);
    
    // Remove typing indicator
    removeTypingIndicator();
    
    // Add assistant message
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date()
    };
    currentSession.messages.push(assistantMessage);
    renderMessage(assistantMessage);
  } catch (error) {
    removeTypingIndicator();
    console.error('Error getting response:', error);
    
    let errorMessage = 'Sorry, I encountered an error. Please try again.';
    if (error instanceof Error) {
      if (error.message.includes('API error: 500') || error.message.includes('API not configured')) {
        errorMessage = 'AI service is not configured. Please check the server setup.';
      } else if (error.message.includes('API error: 401')) {
        errorMessage = 'Authentication failed. Please check the API key configuration.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
    }
    
    const errorMsg: ChatMessage = {
      role: 'assistant',
      content: errorMessage,
      timestamp: new Date()
    };
    currentSession.messages.push(errorMsg);
    renderMessage(errorMsg);
  } finally {
    isGenerating = false;
    saveSessions();
  }
}

/**
 * Get AI response from API
 */
async function getAIResponse(message: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        model: currentModel,
        history: currentSession?.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })) || []
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.reply) {
      return data.reply;
    }
    
    if (data.error || data.message) {
      throw new Error(data.message || data.error || 'Unknown error');
    }
    
    throw new Error('Invalid response format from API');
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

/**
 * Render a message in the chat
 */
function renderMessage(message: ChatMessage) {
  if (!messagesEl) return;

  const messageEl = document.createElement('div');
  messageEl.className = 'message';
  
  const avatarClass = message.role === 'user' ? 'user-avatar' : 'assistant-avatar';
  const avatarText = message.role === 'user' ? 'U' : '';
  
  messageEl.innerHTML = `
    <div class="message-avatar ${avatarClass}">${avatarText}</div>
    <div class="message-content">
      ${formatMessage(message.content)}
    </div>
  `;

  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

/**
 * Format message content (basic markdown support)
 */
function formatMessage(content: string): string {
  // Escape HTML
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  return `<p>${formatted}</p>`;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
  if (!messagesEl) return;

  const typingEl = document.createElement('div');
  typingEl.className = 'message typing-message';
  typingEl.innerHTML = `
    <div class="message-avatar assistant-avatar"></div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

  messagesEl.appendChild(typingEl);
  scrollToBottom();
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
  const typingEl = messagesEl?.querySelector('.typing-message');
  typingEl?.remove();
}

/**
 * Start a new chat session
 */
function startNewChat() {
  currentSession = null;
  
  // Clear messages
  if (messagesEl) {
    messagesEl.innerHTML = '';
    messagesEl.classList.remove('active');
  }
  
  // Show welcome
  welcomeEl?.classList.remove('hidden');
  
  // Update sidebar
  renderChatList();
}

/**
 * Render the chat list in sidebar
 */
function renderChatList() {
  if (!chatListEl) return;

  chatListEl.innerHTML = sessions.map(session => `
    <div class="chat-item ${session === currentSession ? 'active' : ''}" data-id="${session.id}">
      <span class="chat-item-title">${escapeHtml(session.title)}</span>
      <div class="chat-item-actions">
        <button class="chat-item-btn delete-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Add click handlers
  chatListEl.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.delete-btn')) {
        const id = item.getAttribute('data-id');
        deleteSession(id);
      } else {
        const id = item.getAttribute('data-id');
        loadSession(id);
      }
    });
  });
}

/**
 * Load a specific session
 */
function loadSession(id: string | null) {
  if (!id) return;
  
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  currentSession = session;

  // Clear and render messages
  if (messagesEl) {
    messagesEl.innerHTML = '';
    session.messages.forEach(msg => renderMessage(msg));
    
    if (session.messages.length > 0) {
      welcomeEl?.classList.add('hidden');
      messagesEl.classList.add('active');
    } else {
      welcomeEl?.classList.remove('hidden');
      messagesEl.classList.remove('active');
    }
  }

  renderChatList();
}

/**
 * Delete a session
 */
function deleteSession(id: string | null) {
  if (!id) return;
  
  sessions = sessions.filter(s => s.id !== id);
  
  if (currentSession?.id === id) {
    startNewChat();
  }
  
  saveSessions();
  renderChatList();
}

/**
 * Auto-resize textarea
 */
function autoResizeTextarea() {
  if (!inputField) return;
  
  inputField.style.height = 'auto';
  inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
  if (messagesEl) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

/**
 * Save sessions to localStorage
 */
function saveSessions() {
  try {
    localStorage.setItem('claude-chat-sessions', JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
  }
}

/**
 * Load sessions from localStorage
 */
function loadSessions() {
  try {
    const saved = localStorage.getItem('claude-chat-sessions');
    if (saved) {
      sessions = JSON.parse(saved);
      renderChatList();
    }
  } catch (e) {
    console.error('Failed to load sessions:', e);
    sessions = [];
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
