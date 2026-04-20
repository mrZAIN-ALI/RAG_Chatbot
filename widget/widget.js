/**
 * DocMind Embeddable Chat Widget
 * 
 * Include on any website with:
 *   <script src="https://your-api.com/widget.js?id=PROJECT_ID"></script>
 * 
 * Optional configuration via window.DocMindConfig:
 *   { apiBase: "https://api.example.com", primaryColor: "#6366f1" }
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION & INITIALIZATION
  // ============================================================================

  // Extract project_id from script src query parameter
  function getProjectIdFromScript() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('widget.js')) {
        const url = new URL(src);
        return url.searchParams.get('id');
      }
    }
    return null;
  }

  // Get API base URL from config or script origin
  function getApiBase() {
    if (window.DocMindConfig && window.DocMindConfig.apiBase) {
      return window.DocMindConfig.apiBase;
    }
    // Use script origin as fallback
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('widget.js')) {
        return new URL(src).origin;
      }
    }
    return window.location.origin;
  }

  // Get primary color from config or use default
  function getPrimaryColor() {
    if (window.DocMindConfig && window.DocMindConfig.primaryColor) {
      return window.DocMindConfig.primaryColor;
    }
    return '#6366f1'; // Indigo
  }

  const PROJECT_ID = getProjectIdFromScript();
  const API_BASE = getApiBase();
  const PRIMARY_COLOR = getPrimaryColor();
  const STORAGE_KEY = `docmind_credentials_${PROJECT_ID}`;

  if (!PROJECT_ID) {
    console.error('DocMind Widget: project_id not found in script src. Use ?id=PROJECT_ID');
    return;
  }

  // ============================================================================
  // STYLE INJECTION
  // ============================================================================

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Floating Button */
      .docmind-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: ${PRIMARY_COLOR};
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-size: 24px;
        color: white;
        transition: transform 0.2s, box-shadow 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .docmind-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      .docmind-button:active {
        transform: scale(0.95);
      }

      /* Chat Panel */
      .docmind-panel {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 380px;
        height: 560px;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);
        display: none;
        flex-direction: column;
        z-index: 9998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #333;
      }

      .docmind-panel.docmind-open {
        display: flex;
      }

      /* Panel Header */
      .docmind-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background-color: white;
        border-radius: 12px 12px 0 0;
      }

      .docmind-header-title {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
      }

      .docmind-close-button {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .docmind-close-button:hover {
        color: #1f2937;
      }

      /* Credentials Section */
      .docmind-credentials {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: #f9fafb;
      }

      .docmind-credentials.docmind-collapsed {
        display: none;
      }

      .docmind-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .docmind-input-label {
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
        text-transform: uppercase;
      }

      .docmind-input-field {
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        outline: none;
        transition: border-color 0.2s;
      }

      .docmind-input-field:focus {
        border-color: ${PRIMARY_COLOR};
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }

      /* Messages Area */
      .docmind-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background-color: #ffffff;
      }

      .docmind-message {
        display: flex;
        margin-bottom: 4px;
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .docmind-message.docmind-user {
        justify-content: flex-end;
      }

      .docmind-message.docmind-assistant {
        justify-content: flex-start;
      }

      .docmind-message-bubble {
        max-width: 70%;
        padding: 10px 14px;
        border-radius: 12px;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.4;
      }

      .docmind-message.docmind-user .docmind-message-bubble {
        background-color: ${PRIMARY_COLOR};
        color: white;
        border-bottom-right-radius: 4px;
      }

      .docmind-message.docmind-assistant .docmind-message-bubble {
        background-color: #f3f4f6;
        color: #1f2937;
        border-bottom-left-radius: 4px;
      }

      .docmind-message.docmind-error .docmind-message-bubble {
        background-color: #fee2e2;
        color: #991b1b;
      }

      /* Loading Indicator */
      .docmind-loading {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: 10px 14px;
        background-color: #f3f4f6;
        border-radius: 12px;
        width: fit-content;
      }

      .docmind-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #6b7280;
        animation: docmind-bounce 1.4s infinite;
      }

      .docmind-dot:nth-child(1) {
        animation-delay: 0s;
      }

      .docmind-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .docmind-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes docmind-bounce {
        0%, 80%, 100% {
          opacity: 0.5;
          transform: translateY(0);
        }
        40% {
          opacity: 1;
          transform: translateY(-10px);
        }
      }

      /* Input Row */
      .docmind-input-row {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #e5e7eb;
        background-color: white;
        border-radius: 0 0 12px 12px;
      }

      .docmind-input-text {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        outline: none;
        transition: border-color 0.2s;
      }

      .docmind-input-text:focus {
        border-color: ${PRIMARY_COLOR};
      }

      .docmind-send-button {
        padding: 10px 16px;
        background-color: ${PRIMARY_COLOR};
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: opacity 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .docmind-send-button:hover:not(:disabled) {
        opacity: 0.9;
      }

      .docmind-send-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Scrollbar Styling */
      .docmind-messages::-webkit-scrollbar {
        width: 6px;
      }

      .docmind-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .docmind-messages::-webkit-scrollbar-thumb {
        background-color: #d1d5db;
        border-radius: 3px;
      }

      .docmind-messages::-webkit-scrollbar-thumb:hover {
        background-color: #9ca3af;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // DOM CREATION
  // ============================================================================

  function createWidget() {
    // Floating Button
    const button = document.createElement('button');
    button.className = 'docmind-button';
    button.innerHTML = '💬';
    button.setAttribute('aria-label', 'Open DocMind Chat');

    // Chat Panel
    const panel = document.createElement('div');
    panel.className = 'docmind-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'docmind-header';
    header.innerHTML = `
      <div class="docmind-header-title">DocMind Assistant</div>
      <button class="docmind-close-button" aria-label="Close chat">✕</button>
    `;

    // Credentials Section
    const credentials = document.createElement('div');
    credentials.className = 'docmind-credentials';
    credentials.innerHTML = `
      <div class="docmind-input-group">
        <label class="docmind-input-label">Provider</label>
        <input type="text" class="docmind-input-field docmind-provider-input" 
               placeholder="gemini/openai/groq" />
      </div>
      <div class="docmind-input-group">
        <label class="docmind-input-label">Model</label>
        <input type="text" class="docmind-input-field docmind-model-input" 
               placeholder="e.g. gemini-2.0-flash" />
      </div>
      <div class="docmind-input-group">
        <label class="docmind-input-label">API Key</label>
        <input type="password" class="docmind-input-field docmind-apikey-input" 
               placeholder="Your API key" />
      </div>
    `;

    // Messages Area
    const messagesArea = document.createElement('div');
    messagesArea.className = 'docmind-messages';

    // Input Row
    const inputRow = document.createElement('div');
    inputRow.className = 'docmind-input-row';
    inputRow.innerHTML = `
      <input type="text" class="docmind-input-text docmind-message-input" 
             placeholder="Type your message..." />
      <button class="docmind-send-button" aria-label="Send message">Send</button>
    `;

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(credentials);
    panel.appendChild(messagesArea);
    panel.appendChild(inputRow);

    // Add to body
    document.body.appendChild(button);
    document.body.appendChild(panel);

    return {
      button,
      panel,
      credentials,
      messagesArea,
      inputRow,
      closeButton: header.querySelector('.docmind-close-button'),
      sendButton: inputRow.querySelector('.docmind-send-button'),
      messageInput: inputRow.querySelector('.docmind-message-input'),
      providerInput: credentials.querySelector('.docmind-provider-input'),
      modelInput: credentials.querySelector('.docmind-model-input'),
      apikeyInput: credentials.querySelector('.docmind-apikey-input'),
    };
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  function addMessage(content, role, isError = false) {
    const message = document.createElement('div');
    message.className = `docmind-message docmind-${role}${isError ? ' docmind-error' : ''}`;

    const bubble = document.createElement('div');
    bubble.className = 'docmind-message-bubble';
    bubble.textContent = content;

    message.appendChild(bubble);
    return message;
  }

  function showLoadingIndicator() {
    const message = document.createElement('div');
    message.className = 'docmind-message docmind-assistant';

    const loading = document.createElement('div');
    loading.className = 'docmind-loading';
    loading.innerHTML = '<div class="docmind-dot"></div><div class="docmind-dot"></div><div class="docmind-dot"></div>';

    message.appendChild(loading);
    return message;
  }

  function autoScroll(messagesArea) {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  // ============================================================================
  // CREDENTIALS MANAGEMENT
  // ============================================================================

  function loadCredentialsFromStorage() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCredentialsToStorage(provider, model, apiKey) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, model, apiKey }));
    } catch (e) {
      console.warn('Failed to save credentials to sessionStorage:', e);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function initializeWidget() {
    injectStyles();
    const elements = createWidget();

    // Load stored credentials
    const stored = loadCredentialsFromStorage();
    if (stored) {
      elements.providerInput.value = stored.provider;
      elements.modelInput.value = stored.model;
      elements.apikeyInput.value = stored.apiKey;
    }

    // Toggle panel open/close
    elements.button.addEventListener('click', () => {
      elements.panel.classList.add('docmind-open');
    });

    elements.closeButton.addEventListener('click', () => {
      elements.panel.classList.remove('docmind-open');
    });

    // Send message handler
    async function sendMessage() {
      const message = elements.messageInput.value.trim();
      const provider = elements.providerInput.value.trim();
      const model = elements.modelInput.value.trim();
      const apiKey = elements.apikeyInput.value.trim();

      if (!message) return;

      // Validate credentials
      if (!provider || !model || !apiKey) {
        elements.messagesArea.appendChild(
          addMessage('Please fill in all credentials (provider, model, API key).', 'assistant', true)
        );
        autoScroll(elements.messagesArea);
        return;
      }

      // Save credentials for future use
      saveCredentialsToStorage(provider, model, apiKey);

      // Add user message
      elements.messagesArea.appendChild(addMessage(message, 'user'));
      elements.messageInput.value = '';
      elements.sendButton.disabled = true;

      // Show loading indicator
      const loadingMessage = showLoadingIndicator();
      elements.messagesArea.appendChild(loadingMessage);
      autoScroll(elements.messagesArea);

      // Collapse credentials section after first successful message
      elements.credentials.classList.add('docmind-collapsed');

      try {
        // Send to API
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: PROJECT_ID,
            message,
            provider,
            model,
            api_key: apiKey,
          }),
        });

        // Remove loading indicator
        loadingMessage.remove();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Add assistant message
        elements.messagesArea.appendChild(addMessage(data.answer, 'assistant'));
      } catch (error) {
        // Remove loading indicator
        loadingMessage.remove();

        // Show error message
        const errorMsg = 'Something went wrong. Please check your API key and model name.';
        elements.messagesArea.appendChild(addMessage(errorMsg, 'assistant', true));
      } finally {
        elements.sendButton.disabled = false;
        autoScroll(elements.messagesArea);
      }
    }

    // Send button click
    elements.sendButton.addEventListener('click', sendMessage);

    // Enter key to send
    elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Update send button disabled state
    elements.messageInput.addEventListener('input', () => {
      elements.sendButton.disabled = !elements.messageInput.value.trim();
    });

    // Set initial button state
    elements.sendButton.disabled = true;
  }

  // ============================================================================
  // SCRIPT INITIALIZATION
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }
})();
