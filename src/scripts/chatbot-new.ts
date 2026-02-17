// ================================================================================
// Chatbot Module - macOS Window Style Chat Component
// ================================================================================

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: string;
  updatedAt: string;
}

// State Management
let currentModel = 'qwen-turbo';
let currentModelName = 'Qwen Turbo';
let chatHistory: Message[] = [];
let conversations: Conversation[] = [];
let currentConversationId: string | null = null;
let isStreaming = false;
let abortController: AbortController | null = null;
let isWindowMaximized = false;

// Constants
const lang = document.documentElement.lang || 'en';
const API_BASE = 'https://api.agiera.net';

// ================================================================================
// Safe Storage Helpers
// ================================================================================

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[Chatbot] Failed to get ${key} from localStorage:`, e);
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[Chatbot] Failed to set ${key} in localStorage:`, e);
    return false;
  }
}

function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[Chatbot] Failed to remove ${key} from localStorage:`, e);
    return false;
  }
}

function safeGetSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.warn(`[Chatbot] Failed to get ${key} from sessionStorage:`, e);
    return null;
  }
}

function safeSetSessionItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[Chatbot] Failed to set ${key} in sessionStorage:`, e);
    return false;
  }
}

function safeRemoveSessionItem(key: string): boolean {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[Chatbot] Failed to remove ${key} from sessionStorage:`, e);
    return false;
  }
}

// ================================================================================
// Initialization
// ================================================================================

export function initChatbot(): void {
  console.log('[Chatbot] Initializing macOS window style chat...');
  console.log('[Chatbot] Language:', lang);
  console.log('[Chatbot] DOM ready state:', document.readyState);

  if (!document.getElementById('chat-input')) {
    console.error('[Chatbot] Chat input element not found!');
    return;
  }

  // Initialize in correct order
  loadConversations();
  setupModelSelector();
  setupEventListeners();
  setupQuickActions();
  setupWindowControls();
  setupNewChat();
  setupExport();
  setupClearAll();

  console.log('[Chatbot] Initialization complete');
}

// ================================================================================
// Window Controls Setup (macOS Traffic Lights)
// ================================================================================

function setupWindowControls(): void {
  console.log('[WindowControls] Setting up...');

  const closeBtn = document.getElementById('window-close');
  const minimizeBtn = document.getElementById('window-minimize');
  const maximizeBtn = document.getElementById('window-maximize');
  const chatWindow = document.getElementById('chat-window');

  if (!chatWindow) {
    console.error('[WindowControls] Chat window element not found!');
    return;
  }

  // Close button - start new chat
  closeBtn?.addEventListener('click', () => {
    console.log('[WindowControls] Close clicked');
    startNewChat();
    showToast(lang === 'zh' ? '已重置对话' : 'Conversation reset', 'info');
  });

  // Minimize button - minimize the chat window
  minimizeBtn?.addEventListener('click', () => {
    console.log('[WindowControls] Minimize clicked');
    chatWindow.classList.toggle('minimized');
    const isMinimized = chatWindow.classList.contains('minimized');

    // Update button icon/tooltip based on state
    minimizeBtn.setAttribute('aria-label', isMinimized
      ? (lang === 'zh' ? '恢复' : 'Restore')
      : (lang === 'zh' ? '最小化' : 'Minimize')
    );
  });

  // Maximize button - toggle fullscreen/maximize
  maximizeBtn?.addEventListener('click', () => {
    console.log('[WindowControls] Maximize clicked');
    isWindowMaximized = !isWindowMaximized;
    chatWindow.classList.toggle('maximized', isWindowMaximized);

    // Update button icon
    maximizeBtn.setAttribute('aria-label', isWindowMaximized
      ? (lang === 'zh' ? '还原' : 'Restore')
      : (lang === 'zh' ? '最大化' : 'Maximize')
    );

    // Scroll to bottom after resize animation
    setTimeout(() => {
      const chatArea = document.getElementById('chat-area');
      if (chatArea) {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
      }
    }, 300);
  });

  // Double-click on titlebar to maximize/restore
  const titlebar = document.querySelector('.window-titlebar');
  titlebar?.addEventListener('dblclick', (e) => {
    // Prevent triggering when clicking buttons
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    maximizeBtn?.click();
  });

  console.log('[WindowControls] Setup complete');
}

// ================================================================================
// Model Selector Setup
// ================================================================================

function setupModelSelector(): void {
  console.log('[ModelSelector] ========== SETUP START ==========');

  const modelBtn = document.getElementById('model-selector-btn');
  const modelDropdown = document.getElementById('model-dropdown');
  const modelCurrentName = document.getElementById('model-current-name');

  console.log('[ModelSelector] Button element:', modelBtn);
  console.log('[ModelSelector] Dropdown element:', modelDropdown);

  if (!modelBtn || !modelDropdown) {
    console.error('[ModelSelector] Required elements not found!');
    return;
  }

  // Remove any existing listeners (prevent duplicates)
  const newBtn = modelBtn.cloneNode(true) as HTMLElement;
  modelBtn.parentNode?.replaceChild(newBtn, modelBtn);

  // Toggle dropdown on button click
  newBtn.addEventListener('click', (e) => {
    console.log('[ModelSelector] Button clicked');
    e.stopPropagation();
    e.preventDefault();

    const isVisible = modelDropdown.classList.contains('visible');

    if (isVisible) {
      modelDropdown.classList.remove('visible');
      newBtn.setAttribute('aria-expanded', 'false');
    } else {
      modelDropdown.classList.add('visible');
      newBtn.setAttribute('aria-expanded', 'true');
      positionDropdown(modelDropdown, newBtn);
    }
  });

  // Handle model selection
  const modelOptions = modelDropdown.querySelectorAll('.model-option');
  console.log('[ModelSelector] Found', modelOptions.length, 'model options');

  modelOptions.forEach((option) => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const model = option.getAttribute('data-model');
      const name = option.getAttribute('data-name');

      if (model && name) {
        selectModel(model, name);
        modelDropdown.classList.remove('visible');
        newBtn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    if (!modelDropdown.contains(target) && !newBtn.contains(target)) {
      if (modelDropdown.classList.contains('visible')) {
        modelDropdown.classList.remove('visible');
        newBtn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Keyboard navigation
  newBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      newBtn.click();
    } else if (e.key === 'Escape') {
      modelDropdown.classList.remove('visible');
      newBtn.setAttribute('aria-expanded', 'false');
    }
  });

  console.log('[ModelSelector] ========== SETUP COMPLETE ==========');
}

function positionDropdown(dropdown: HTMLElement, button: HTMLElement): void {
  dropdown.style.left = '8px';
  dropdown.style.right = 'auto';

  const rect = button.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  const viewportWidth = window.innerWidth;

  if (rect.left + dropdownRect.width > viewportWidth - 16) {
    dropdown.style.left = 'auto';
    dropdown.style.right = '8px';
  }
}

function selectModel(model: string, name: string): void {
  console.log('[ModelSelector] Selecting model:', model, name);

  currentModel = model;
  currentModelName = name;

  // Update UI - model options in dropdown
  const modelDropdown = document.getElementById('model-dropdown');
  if (modelDropdown) {
    const options = modelDropdown.querySelectorAll('.model-option');
    options.forEach(opt => {
      const optModel = opt.getAttribute('data-model');
      const isActive = optModel === model;
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  // Update button text
  const modelCurrentName = document.getElementById('model-current-name');
  if (modelCurrentName) {
    const shortName = getShortModelName(name);
    modelCurrentName.textContent = shortName;
  }

  showToast(`${lang === 'zh' ? '已切换到' : 'Switched to'} ${name}`, 'success');
}

function getShortModelName(fullName: string): string {
  const nameMap: Record<string, string> = {
    'Doubao 2.0 Pro': 'Doubao Pro',
    'Doubao 2.0 Code': 'Doubao Code',
    'Qwen Turbo': 'Qwen Turbo',
    'Qwen Plus': 'Qwen Plus'
  };
  return nameMap[fullName] || fullName;
}

// ================================================================================
// Event Listeners Setup
// ================================================================================

function setupEventListeners(): void {
  console.log('[Chatbot] Setting up event listeners...');

  const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

  if (chatInput && sendBtn) {
    chatInput.addEventListener('input', () => {
      sendBtn.disabled = chatInput.value.trim() === '';

      // Auto-resize textarea
      const maxHeight = window.innerWidth <= 768 ? 100 : 120;
      chatInput.style.height = 'auto';
      const newHeight = Math.min(chatInput.scrollHeight, maxHeight);
      chatInput.style.height = newHeight + 'px';
    });

    // Mobile keyboard handling
    chatInput.addEventListener('focus', () => {
      if (window.innerWidth <= 768) {
        setTimeout(() => {
          const inputArea = document.getElementById('input-area');
          if (inputArea) {
            inputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 300);
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    if (stopBtn) {
      stopBtn.addEventListener('click', stopGeneration);
    }

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!sendBtn.disabled && !isStreaming) {
          sendMessage();
        }
      }
    });
  }
}

// ================================================================================
// Quick Actions Setup
// ================================================================================

function setupQuickActions(): void {
  const quickActions = document.querySelectorAll('.quick-action');
  const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

  quickActions.forEach(action => {
    action.addEventListener('click', () => {
      const prompt = action.getAttribute('data-prompt');
      if (prompt && chatInput) {
        chatInput.value = prompt;
        chatInput.focus();
        if (sendBtn) {
          sendBtn.disabled = false;
        }
        chatInput.dispatchEvent(new Event('input'));
      }
    });
  });
}

// ================================================================================
// New Chat Setup
// ================================================================================

function setupNewChat(): void {
  const newChatBtn = document.getElementById('new-chat-btn');
  newChatBtn?.addEventListener('click', () => {
    startNewChat();
    showToast(lang === 'zh' ? '新对话已开始' : 'New conversation started', 'success');
  });
}

// ================================================================================
// Clear All Setup
// ================================================================================

function setupClearAll(): void {
  const clearAllBtn = document.getElementById('clear-all-btn');

  clearAllBtn?.addEventListener('click', () => {
    const confirmMessage = lang === 'zh'
      ? '确定要清除所有对话历史吗？此操作无法撤销。'
      : 'Are you sure you want to clear all conversation history? This cannot be undone.';

    if (confirm(confirmMessage)) {
      conversations = [];
      safeRemoveItem('chatbot_conversations');
      safeRemoveSessionItem('chatbot_session_id');
      startNewChat();
      showToast(lang === 'zh' ? '所有对话已清除' : 'All conversations cleared', 'success');
    }
  });
}

// ================================================================================
// Export Setup
// ================================================================================

function setupExport(): void {
  const exportBtn = document.getElementById('export-btn');

  exportBtn?.addEventListener('click', () => {
    if (chatHistory.length === 0) {
      showToast(lang === 'zh' ? '没有可导出的对话' : 'No conversation to export', 'error');
      return;
    }

    const exportData = {
      title: conversations.find(c => c.id === currentConversationId)?.title || 'Chat Export',
      model: currentModel,
      messages: chatHistory,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(lang === 'zh' ? '对话已导出' : 'Conversation exported', 'success');
  });
}

// ================================================================================
// Send Message
// ================================================================================

async function sendMessage(): Promise<void> {
  const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
  const content = chatInput?.value.trim();

  if (!content || isStreaming) {
    return;
  }

  // Performance tracking
  const startTime = performance.now();
  const ttfbStart = performance.now();

  // Hide welcome screen
  const welcomeScreen = document.getElementById('welcome-screen');
  if (welcomeScreen) {
    welcomeScreen.classList.add('hidden');
  }

  // Add user message
  addMessage('user', content);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Set streaming state
  isStreaming = true;

  // Disable input and show loading state
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

  if (sendBtn) {
    sendBtn.style.display = 'none';
  }
  if (stopBtn) {
    stopBtn.style.display = 'flex';
  }
  if (chatInput) {
    chatInput.disabled = true;
  }

  // Show typing indicator with model info
  showTypingIndicator();

  // Create abort controller
  abortController = new AbortController();

  try {
    // Optimize history - keep only last 5 messages
    const optimizedHistory = chatHistory.slice(-10, -1).map(msg => ({
      role: msg.role,
      content: msg.content.length > 1000 ? msg.content.slice(0, 1000) + '...' : msg.content
    }));

    const requestBody = {
      message: content,
      model: currentModel,
      history: optimizedHistory,
      stream: false
    };

    console.log('[Chatbot] Sending message with model:', currentModel);
    console.log('[Performance] Request start');

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });

    const ttfb = performance.now() - ttfbStart;
    console.log(`[Performance] TTFB: ${ttfb.toFixed(2)}ms`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const totalTime = performance.now() - startTime;
    console.log(`[Performance] Total time: ${totalTime.toFixed(2)}ms`);

    if (data.latency) {
      console.log(`[Performance] Provider latency: ${data.latency.provider}ms`);
      console.log(`[Performance] Server total: ${data.latency.total}ms`);
    }

    removeTypingIndicator();

    if (data.success && data.reply) {
      addMessage('assistant', data.reply);

      // Show performance info if slow
      if (ttfb > 3000) {
        console.warn(`[Performance] Slow response detected: ${ttfb.toFixed(0)}ms`);
        if (currentModel !== 'qwen-turbo') {
          showToast(lang === 'zh' ? '响应较慢，建议切换到 Qwen Turbo 模型' : 'Slow response detected. Consider switching to Qwen Turbo', 'info');
        }
      }
    } else {
      showToast(data.message || 'Failed to get response', 'error');
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      removeTypingIndicator();
      addMessage('assistant', lang === 'zh' ? '生成已停止。' : 'Generation stopped.');
    } else {
      console.error('[Chatbot] Fetch error:', error);
      removeTypingIndicator();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`${lang === 'zh' ? '网络错误' : 'Network error'}: ${errorMessage}`, 'error');

      addMessage('assistant', lang === 'zh'
        ? `抱歉，发生了错误：${errorMessage}。请稍后重试。`
        : `Sorry, an error occurred: ${errorMessage}. Please try again later.`
      );
    }
  } finally {
    // Reset streaming state
    isStreaming = false;
    abortController = null;

    const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

    if (sendBtn) {
      sendBtn.style.display = 'flex';
      sendBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.focus();
    }
  }
}

// ================================================================================
// Stop Generation
// ================================================================================

function stopGeneration(): void {
  if (abortController) {
    abortController.abort();
  }
}

// ================================================================================
// Add Message
// ================================================================================

function addMessage(role: 'user' | 'assistant', content: string, shouldSave: boolean = true): void {
  const messagesContainer = document.getElementById('messages-container');
  const chatArea = document.getElementById('chat-area');
  if (!messagesContainer) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}-message`;

  if (role === 'user') {
    messageDiv.innerHTML = `
      <div class="message-bubble">
        <p>${escapeHtml(content)}</p>
        <span class="message-time">${timeStr}</span>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="assistant-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </div>
      <div class="message-content">
        <p>${escapeHtml(content)}</p>
        <div class="message-footer">
          <span class="message-time">${timeStr}</span>
          <button class="copy-btn" aria-label="${lang === 'zh' ? '复制消息' : 'Copy message'}" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  messagesContainer.appendChild(messageDiv);

  // Add copy button event listener
  const copyBtn = messageDiv.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        showToast(lang === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard', 'success');
      }).catch(() => {
        showToast(lang === 'zh' ? '复制失败' : 'Copy failed', 'error');
      });
    });
  }

  // Scroll to bottom
  if (chatArea) {
    requestAnimationFrame(() => {
      chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  // Add to history
  if (shouldSave) {
    chatHistory.push({
      role,
      content,
      timestamp: now.toISOString()
    });

    saveConversation();
  }
}

// ================================================================================
// Typing Indicator
// ================================================================================

function showTypingIndicator(): void {
  const messagesContainer = document.getElementById('messages-container');
  const chatArea = document.getElementById('chat-area');
  if (!messagesContainer) return;

  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typing-indicator';

  const modelDisplayName = getShortModelName(currentModelName);
  const thinkingText = lang === 'zh' ? `${modelDisplayName} 正在思考` : `${modelDisplayName} is thinking`;

  typingDiv.innerHTML = `
    <div class="typing-content">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-text">${thinkingText}</span>
    </div>
  `;

  messagesContainer.appendChild(typingDiv);

  if (chatArea) {
    requestAnimationFrame(() => {
      chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

function removeTypingIndicator(): void {
  const typingIndicator = document.getElementById('typing-indicator');
  typingIndicator?.remove();
}

// ================================================================================
// New Chat
// ================================================================================

function startNewChat(): void {
  safeRemoveSessionItem('chatbot_session_id');
  currentConversationId = null;
  chatHistory = [];

  const messagesContainer = document.getElementById('messages-container');
  const welcomeScreen = document.getElementById('welcome-screen');

  if (messagesContainer) {
    messagesContainer.innerHTML = '';
  }

  if (welcomeScreen) {
    welcomeScreen.classList.remove('hidden');
  }

  // Reset input
  const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }
  if (sendBtn) {
    sendBtn.disabled = true;
  }
}

// ================================================================================
// Load Conversations
// ================================================================================

function loadConversations(): void {
  const stored = safeGetItem('chatbot_conversations');
  if (stored) {
    try {
      conversations = JSON.parse(stored);
    } catch (e) {
      console.error('[Chatbot] Failed to parse conversations:', e);
      conversations = [];
    }
  }

  const sessionId = safeGetSessionItem('chatbot_session_id');
  if (sessionId) {
    currentConversationId = sessionId;
    const conv = conversations.find(c => c.id === sessionId);
    if (conv) {
      chatHistory = [...conv.messages];

      const messagesContainer = document.getElementById('messages-container');
      const welcomeScreen = document.getElementById('welcome-screen');

      if (messagesContainer && chatHistory.length > 0) {
        if (welcomeScreen) {
          welcomeScreen.classList.add('hidden');
        }

        chatHistory.forEach(msg => {
          addMessage(msg.role, msg.content, false);
        });
      }
    }
  }
}

// ================================================================================
// Save Conversation
// ================================================================================

function saveConversation(): void {
  let sessionId = safeGetSessionItem('chatbot_session_id');

  if (!sessionId) {
    sessionId = 'session_' + Date.now().toString();
    safeSetSessionItem('chatbot_session_id', sessionId);
    currentConversationId = sessionId;

    conversations.unshift({
      id: currentConversationId,
      title: chatHistory[0]?.content.slice(0, 50) || (lang === 'zh' ? '新对话' : 'New Chat'),
      messages: [...chatHistory],
      model: currentModel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } else {
    currentConversationId = sessionId;
    const conv = conversations.find(c => c.id === sessionId);
    if (conv) {
      conv.messages = [...chatHistory];
      conv.updatedAt = new Date().toISOString();
      if (chatHistory.length > 0) {
        conv.title = chatHistory[0].content.slice(0, 50);
      }
    } else {
      conversations.unshift({
        id: sessionId,
        title: chatHistory[0]?.content.slice(0, 50) || (lang === 'zh' ? '新对话' : 'New Chat'),
        messages: [...chatHistory],
        model: currentModel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  safeSetItem('chatbot_conversations', JSON.stringify(conversations));
}

// ================================================================================
// Show Toast
// ================================================================================

function showToast(message: string, type: 'success' | 'error' | 'info'): void {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(calc(100% + var(--space-6)))';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ================================================================================
// Utility Functions
// ================================================================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================================================================================
// Global Error Handlers
// ================================================================================

window.addEventListener('error', (e) => {
  console.error('[Chatbot] Global error:', e.error);
  showToast(lang === 'zh' ? '发生错误，请刷新页面重试' : 'An error occurred, please refresh the page', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Chatbot] Unhandled promise rejection:', e.reason);
  showToast(lang === 'zh' ? '发生错误，请刷新页面重试' : 'An error occurred, please refresh the page', 'error');
});

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
