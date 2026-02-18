// ================================================================================
// Chatbot Module - Optimized UI with Model Selector Button
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
let currentModel = 'doubao-2.0-pro';
let currentModelName = 'Doubao 2.0 Pro';
let chatHistory: Message[] = [];
let conversations: Conversation[] = [];
let currentConversationId: string | null = null;
let isStreaming = false;
let abortController: AbortController | null = null;
let searchDebounceTimer: number | null = null;

// Constants
const lang = document.documentElement.lang || 'en';
const API_BASE = 'https://api.ustc.dev';

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
  console.log('[Chatbot] Initializing...');
  console.log('[Chatbot] Language:', lang);
  console.log('[Chatbot] DOM ready state:', document.readyState);
  
  if (!document.getElementById('chat-input')) {
    console.error('[Chatbot] Chat input element not found!');
    return;
  }
  
  // Initialize in correct order
  loadConversations();
  setupModelSelector(); // Setup model selector first
  setupEventListeners();
  setupQuickActions();
  setupSidebarToggle();
  setupSearch();
  setupSectionToggle();
  setupSettings();
  setupClearAll();
  setupExport();
  
  console.log('[Chatbot] Initialization complete');
}

// ================================================================================
// Model Selector Setup - COMPLETE REWRITE WITH DEBUGGING
// ================================================================================

function setupModelSelector(): void {
  console.log('[ModelSelector] ========== SETUP START ==========');
  
  const modelBtn = document.getElementById('model-selector-btn');
  const modelDropdown = document.getElementById('model-dropdown');
  const modelCurrentName = document.getElementById('model-current-name');
  
  console.log('[ModelSelector] Button element:', modelBtn);
  console.log('[ModelSelector] Dropdown element:', modelDropdown);
  console.log('[ModelSelector] Name display element:', modelCurrentName);
  console.log('[ModelSelector] Button exists:', !!modelBtn);
  console.log('[ModelSelector] Dropdown exists:', !!modelDropdown);
  
  if (!modelBtn) {
    console.error('[ModelSelector] CRITICAL: Button element not found!');
    console.log('[ModelSelector] Available buttons:', document.querySelectorAll('button'));
    return;
  }
  
  if (!modelDropdown) {
    console.error('[ModelSelector] CRITICAL: Dropdown element not found!');
    return;
  }
  
  // Check if button is visible and clickable
  const btnStyles = window.getComputedStyle(modelBtn);
  console.log('[ModelSelector] Button display:', btnStyles.display);
  console.log('[ModelSelector] Button visibility:', btnStyles.visibility);
  console.log('[ModelSelector] Button pointer-events:', btnStyles.pointerEvents);
  console.log('[ModelSelector] Button z-index:', btnStyles.zIndex);
  
  // Remove any existing listeners (prevent duplicates)
  const newBtn = modelBtn.cloneNode(true) as HTMLElement;
  modelBtn.parentNode?.replaceChild(newBtn, modelBtn);
  
  console.log('[ModelSelector] Button cloned, new element:', newBtn);
  
  // Toggle dropdown on button click - using mousedown for better responsiveness
  newBtn.addEventListener('mousedown', (e) => {
    console.log('[ModelSelector] ========== BUTTON CLICKED ==========');
    console.log('[ModelSelector] Event type:', e.type);
    console.log('[ModelSelector] Event target:', e.target);
    e.stopPropagation();
    e.preventDefault();
    
    const isVisible = modelDropdown.classList.contains('visible');
    console.log('[ModelSelector] Dropdown currently visible:', isVisible);
    console.log('[ModelSelector] Dropdown classes before toggle:', modelDropdown.className);
    
    // Toggle visibility
    if (isVisible) {
      modelDropdown.classList.remove('visible');
      newBtn.setAttribute('aria-expanded', 'false');
      console.log('[ModelSelector] Dropdown hidden');
    } else {
      modelDropdown.classList.add('visible');
      newBtn.setAttribute('aria-expanded', 'true');
      console.log('[ModelSelector] Dropdown shown');
      positionDropdown(modelDropdown, newBtn);
    }
    
    console.log('[ModelSelector] Dropdown classes after toggle:', modelDropdown.className);
    console.log('[ModelSelector] aria-expanded:', newBtn.getAttribute('aria-expanded'));
  });
  
  // Also handle click event as fallback
  newBtn.addEventListener('click', (e) => {
    console.log('[ModelSelector] Click event fired');
    e.stopPropagation();
    e.preventDefault();
  });
  
  // Handle model selection
  const modelOptions = modelDropdown.querySelectorAll('.model-option');
  console.log('[ModelSelector] Found', modelOptions.length, 'model options');
  
  modelOptions.forEach((option, index) => {
    console.log(`[ModelSelector] Setting up option ${index}:`, option.getAttribute('data-model'));
    
    option.addEventListener('click', (e) => {
      console.log('[ModelSelector] ========== OPTION SELECTED ==========');
      e.stopPropagation();
      e.preventDefault();
      
      const model = option.getAttribute('data-model');
      const name = option.getAttribute('data-name');
      console.log('[ModelSelector] Selected model:', model, name);
      
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
        console.log('[ModelSelector] Closing dropdown (click outside)');
        modelDropdown.classList.remove('visible');
        newBtn.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  // Keyboard navigation
  newBtn.addEventListener('keydown', (e) => {
    console.log('[ModelSelector] Keydown on button:', e.key);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      newBtn.dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') {
      modelDropdown.classList.remove('visible');
      newBtn.setAttribute('aria-expanded', 'false');
    }
  });
  
  // Setup keyboard navigation for options
  modelOptions.forEach((option, index) => {
    option.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'ArrowDown') {
        e.preventDefault();
        const next = modelOptions[index + 1] || modelOptions[0];
        (next as HTMLElement).focus();
      } else if (keyEvent.key === 'ArrowUp') {
        e.preventDefault();
        const prev = modelOptions[index - 1] || modelOptions[modelOptions.length - 1];
        (prev as HTMLElement).focus();
      } else if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        e.preventDefault();
        (option as HTMLElement).click();
      } else if (keyEvent.key === 'Escape') {
        modelDropdown.classList.remove('visible');
        newBtn.setAttribute('aria-expanded', 'false');
        newBtn.focus();
      }
    });
  });
  
  console.log('[ModelSelector] ========== SETUP COMPLETE ==========');
}

function positionDropdown(dropdown: HTMLElement, button: HTMLElement): void {
  console.log('[ModelSelector] Positioning dropdown');
  
  // Reset any manual positioning
  dropdown.style.left = '8px';
  dropdown.style.right = 'auto';
  
  const rect = button.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  
  console.log('[ModelSelector] Button rect:', rect);
  console.log('[ModelSelector] Dropdown rect:', dropdownRect);
  console.log('[ModelSelector] Viewport width:', viewportWidth);
  
  // Ensure dropdown doesn't go off-screen on the right
  if (rect.left + dropdownRect.width > viewportWidth - 16) {
    console.log('[ModelSelector] Adjusting position to prevent overflow');
    dropdown.style.left = 'auto';
    dropdown.style.right = '8px';
  }
}

function selectModel(model: string, name: string): void {
  console.log('[ModelSelector] ========== SELECTING MODEL ==========');
  console.log('[ModelSelector] Model:', model);
  console.log('[ModelSelector] Name:', name);
  
  currentModel = model;
  currentModelName = name;
  
  // Update UI - model options in dropdown
  const modelDropdown = document.getElementById('model-dropdown');
  if (modelDropdown) {
    const options = modelDropdown.querySelectorAll('.model-option');
    console.log('[ModelSelector] Updating', options.length, 'options');
    
    options.forEach(opt => {
      const optModel = opt.getAttribute('data-model');
      const isActive = optModel === model;
      console.log('[ModelSelector] Option', optModel, 'active:', isActive);
      
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }
  
  // Update button text
  const modelCurrentName = document.getElementById('model-current-name');
  if (modelCurrentName) {
    const shortName = getShortModelName(name);
    console.log('[ModelSelector] Updating button text to:', shortName);
    modelCurrentName.textContent = shortName;
  }
  
  showToast(`${lang === 'zh' ? '已切换到' : 'Switched to'} ${name}`, 'success');
  console.log('[ModelSelector] ========== MODEL SELECTED ==========');
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
  
  // New chat
  const newChatBtn = document.getElementById('new-chat-btn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
  }
  
  // Send message
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
// Sidebar Toggle Setup
// ================================================================================

function setupSidebarToggle(): void {
  const menuToggle = document.getElementById('menu-toggle');
  const closeSidebar = document.getElementById('close-sidebar');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  function openSidebar() {
    sidebar?.classList.add('open');
    overlay?.classList.add('visible');
    menuToggle?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  
  function closeSidebarFn() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('visible');
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  
  menuToggle?.addEventListener('click', openSidebar);
  closeSidebar?.addEventListener('click', closeSidebarFn);
  overlay?.addEventListener('click', closeSidebarFn);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
      closeSidebarFn();
    }
  });
}

// ================================================================================
// Search Setup
// ================================================================================

function setupSearch(): void {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  
  if (!searchInput) return;
  
  searchInput.addEventListener('input', () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    searchDebounceTimer = window.setTimeout(() => {
      const query = searchInput.value.toLowerCase().trim();
      filterConversations(query);
    }, 300);
  });
}

function filterConversations(query: string): void {
  const historyItems = document.querySelectorAll('.history-item');
  
  historyItems.forEach(item => {
    const title = item.querySelector('.history-title')?.textContent?.toLowerCase() || '';
    if (query === '' || title.includes(query)) {
      (item as HTMLElement).style.display = '';
    } else {
      (item as HTMLElement).style.display = 'none';
    }
  });
}

// ================================================================================
// Section Toggle Setup
// ================================================================================

function setupSectionToggle(): void {
  const sectionHeaders = document.querySelectorAll('.section-header');
  
  sectionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.getAttribute('data-toggle');
      const list = document.getElementById(`history-${section}`);
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      
      header.setAttribute('aria-expanded', (!isExpanded).toString());
      list?.classList.toggle('collapsed', isExpanded);
    });
  });
}

// ================================================================================
// Settings Setup
// ================================================================================

function setupSettings(): void {
  const settingsBtn = document.getElementById('settings-btn');
  
  settingsBtn?.addEventListener('click', () => {
    showToast(lang === 'zh' ? '设置功能即将推出' : 'Settings coming soon', 'info');
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
    const requestBody = {
      message: content,
      model: currentModel,
      history: chatHistory,
      stream: false  // Set to true to enable streaming
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
  
  renderHistory();
  
  // Close mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuToggle = document.getElementById('menu-toggle');
  if (sidebar?.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay?.classList.remove('visible');
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
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
  renderHistory();
}

// ================================================================================
// Render History
// ================================================================================

function renderHistory(): void {
  const todayList = document.getElementById('history-today');
  const weekList = document.getElementById('history-week');
  const olderList = document.getElementById('history-older');
  
  if (!todayList || !weekList || !olderList) return;
  
  todayList.innerHTML = '';
  weekList.innerHTML = '';
  olderList.innerHTML = '';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  let todayCount = 0, weekCount = 0, olderCount = 0;
  
  conversations.forEach(conv => {
    const convDate = new Date(conv.createdAt);
    const item = document.createElement('div');
    item.className = 'history-item';
    if (conv.id === currentConversationId) item.classList.add('active');
    
    item.innerHTML = `
      <div class="history-item-content">
        <span class="history-title">${escapeHtml(conv.title)}</span>
        <span class="history-date">${formatDate(convDate)}</span>
      </div>
    `;
    
    item.addEventListener('click', () => loadConversation(conv.id));
    
    if (convDate >= today) {
      todayList.appendChild(item);
      todayCount++;
    } else if (convDate >= weekAgo) {
      weekList.appendChild(item);
      weekCount++;
    } else {
      olderList.appendChild(item);
      olderCount++;
    }
  });
  
  const countToday = document.getElementById('count-today');
  const countWeek = document.getElementById('count-week');
  const countOlder = document.getElementById('count-older');
  
  if (countToday) countToday.textContent = todayCount.toString();
  if (countWeek) countWeek.textContent = weekCount.toString();
  if (countOlder) countOlder.textContent = olderCount.toString();
}

// ================================================================================
// Load Conversation
// ================================================================================

function loadConversation(id: string): void {
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;
  
  currentConversationId = id;
  chatHistory = [...conv.messages];
  
  const messagesContainer = document.getElementById('messages-container');
  const welcomeScreen = document.getElementById('welcome-screen');
  
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
    chatHistory.forEach(msg => addMessage(msg.role, msg.content, false));
  }
  
  if (welcomeScreen) {
    welcomeScreen.classList.add('hidden');
  }
  
  renderHistory();
  
  // Close mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuToggle = document.getElementById('menu-toggle');
  if (sidebar?.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay?.classList.remove('visible');
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
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

function formatDate(date: Date): string {
  return date.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
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
