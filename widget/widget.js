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

  function getWidgetScriptElement() {
    if (document.currentScript && document.currentScript.src && document.currentScript.src.includes('widget.js')) {
      return document.currentScript;
    }

    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src;
      if (src && src.includes('widget.js')) {
        return scripts[i];
      }
    }

    return null;
  }

  // Extract project_id from script src query parameter
  function getProjectIdFromScript() {
    const script = getWidgetScriptElement();
    if (!script) return null;

    const url = new URL(script.src);
    return url.searchParams.get('id');
  }

  function normalizeOrigin(value) {
    return String(value).replace(/\/+$/, '');
  }

  // Get API base URL from config or the deployed script origin
  function getApiBase() {
    if (window.DocMindConfig && window.DocMindConfig.apiBase) {
      return normalizeOrigin(window.DocMindConfig.apiBase);
    }

    const script = getWidgetScriptElement();
    if (script) {
      return new URL(script.src).origin;
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
        line-height: 1;
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
        width: min(560px, calc(100vw - 32px));
        height: min(760px, calc(100vh - 100px));
        min-height: 520px;
        background-color: white;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
        display: none;
        flex-direction: column;
        z-index: 9998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #333;
        overflow: hidden;
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
        background-color: #ffffff;
        border-radius: 10px 10px 0 0;
        flex: 0 0 auto;
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

      /* Messages Area */
      .docmind-messages {
        flex: 1;
        min-height: 0;
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
        animation: docmind-slide-in 0.3s ease-out;
      }

      @keyframes docmind-slide-in {
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
        max-width: 84%;
        padding: 10px 14px;
        border-radius: 12px;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        font-size: 14px;
        line-height: 1.4;
      }

      .docmind-message-bubble p {
        margin: 0 0 8px;
      }

      .docmind-message-bubble p:last-child,
      .docmind-message-bubble ul:last-child,
      .docmind-message-bubble ol:last-child {
        margin-bottom: 0;
      }

      .docmind-message-bubble ul,
      .docmind-message-bubble ol {
        margin: 0 0 8px 18px;
        padding: 0;
      }

      .docmind-message-bubble li {
        margin: 3px 0;
      }

      .docmind-message-bubble strong {
        font-weight: 700;
      }

      .docmind-message-bubble em {
        font-style: italic;
      }

      .docmind-message-bubble code {
        border-radius: 4px;
        background: rgba(15, 23, 42, 0.08);
        padding: 1px 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.92em;
      }

      .docmind-message.docmind-user .docmind-message-bubble {
        max-width: 78%;
        background-color: ${PRIMARY_COLOR};
        color: white;
        border-bottom-right-radius: 4px;
      }

      .docmind-message.docmind-assistant .docmind-message-bubble {
        max-width: 88%;
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
        padding: 14px 16px;
        border-top: 1px solid #e5e7eb;
        background-color: white;
        border-radius: 0 0 10px 10px;
        flex: 0 0 auto;
      }

      .docmind-input-text {
        flex: 1;
        padding: 12px 12px;
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
        min-width: 76px;
        padding: 12px 18px;
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

      @media (max-width: 420px), (max-height: 520px) {
        .docmind-button {
          bottom: 14px;
          right: 14px;
        }

        .docmind-panel {
          right: 14px;
          bottom: 84px;
          width: calc(100vw - 28px);
          height: calc(100vh - 98px);
          min-height: 0;
        }
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
    button.textContent = 'DM';
    button.setAttribute('aria-label', 'Open DocMind Chat');

    // Chat Panel
    const panel = document.createElement('div');
    panel.className = 'docmind-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'docmind-header';
    header.innerHTML = `
      <div class="docmind-header-title">DocMind Assistant</div>
      <button class="docmind-close-button" aria-label="Close chat">x</button>
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
    panel.appendChild(messagesArea);
    panel.appendChild(inputRow);

    // Add to body
    document.body.appendChild(button);
    document.body.appendChild(panel);

    return {
      button,
      panel,
      messagesArea,
      inputRow,
      headerTitle: header.querySelector('.docmind-header-title'),
      closeButton: header.querySelector('.docmind-close-button'),
      sendButton: inputRow.querySelector('.docmind-send-button'),
      messageInput: inputRow.querySelector('.docmind-message-input'),
    };
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatInlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  }

  function normalizeMarkdown(content) {
    return String(content)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+((?:[-*]|\d+\.)\s+(?=(?:\*\*)?[A-Za-z0-9(]))/g, '\n$1');
  }

  function markdownToHtml(content) {
    const normalized = normalizeMarkdown(content);
    const lines = normalized.split('\n');
    const blocks = [];
    let listItems = [];
    let listType = 'ul';

    function flushList(nextType) {
      if (listItems.length > 0) {
        blocks.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join('')}</${listType}>`);
        listItems = [];
      }
      if (nextType) {
        listType = nextType;
      }
    }

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }

      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        if (listType !== 'ul') flushList('ul');
        listType = 'ul';
        listItems.push(formatInlineMarkdown(bulletMatch[1]));
        return;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (orderedMatch) {
        if (listType !== 'ol') flushList('ol');
        listType = 'ol';
        listItems.push(formatInlineMarkdown(orderedMatch[1]));
        return;
      }

      const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
      if (headingMatch) {
        flushList();
        blocks.push(`<p><strong>${formatInlineMarkdown(headingMatch[1])}</strong></p>`);
        return;
      }

      flushList();
      blocks.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
    });

    flushList();
    return blocks.join('');
  }

  function addMessage(content, role, isError = false, options = {}) {
    const message = document.createElement('div');
    message.className = `docmind-message docmind-${role}${isError ? ' docmind-error' : ''}`;
    if (options.previewWelcome) {
      message.setAttribute('data-docmind-preview-welcome', 'true');
    }

    const bubble = document.createElement('div');
    bubble.className = 'docmind-message-bubble';
    bubble.innerHTML = role === 'assistant' ? markdownToHtml(content) : escapeHtml(content);

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
  // EVENT HANDLERS
  // ============================================================================

  function initializeWidget() {
    injectStyles();
    const elements = createWidget();
    let widgetConfig = null;
    let historyLoaded = false;
    let historyLoading = false;
    let configLoading = false;

    function getWelcomeMessage() {
      if (widgetConfig && widgetConfig.welcome_message) {
        return widgetConfig.welcome_message;
      }
      return 'Welcome to this website. Ask me anything and I will help using the information provided by this organization.';
    }

    function renderWelcomeIfEmpty() {
      if (elements.messagesArea.children.length === 0) {
        elements.messagesArea.appendChild(addMessage(getWelcomeMessage(), 'assistant', false, { previewWelcome: true }));
        autoScroll(elements.messagesArea);
      }
    }

    function removePreviewWelcome() {
      const previewWelcome = elements.messagesArea.querySelector('[data-docmind-preview-welcome="true"]');
      if (previewWelcome) {
        previewWelcome.remove();
      }
    }

    async function loadWidgetConfig() {
      if (widgetConfig || configLoading) return widgetConfig;

      configLoading = true;
      try {
        const response = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(PROJECT_ID)}/widget-config`);
        if (!response.ok) return widgetConfig;

        widgetConfig = await response.json();
        if (widgetConfig && widgetConfig.name && elements.headerTitle) {
          elements.headerTitle.textContent = `${widgetConfig.name} Assistant`;
        }
      } catch (error) {
        // The widget can still chat without public config.
      } finally {
        configLoading = false;
      }

      return widgetConfig;
    }

    async function loadHistory() {
      if (historyLoaded || historyLoading || elements.messagesArea.children.length > 0) return;

      historyLoading = true;
      try {
        await loadWidgetConfig();
        const response = await fetch(`${API_BASE}/api/history/${encodeURIComponent(PROJECT_ID)}`);
        if (!response.ok) {
          renderWelcomeIfEmpty();
          return;
        }

        const history = await response.json();
        if (!Array.isArray(history)) {
          renderWelcomeIfEmpty();
          return;
        }

        if (elements.messagesArea.children.length > 0) {
          historyLoaded = true;
          return;
        }

        let appended = 0;
        history
          .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content)
          .forEach((item) => {
            elements.messagesArea.appendChild(addMessage(item.content, item.role));
            appended += 1;
          });

        if (appended === 0) {
          renderWelcomeIfEmpty();
        }
        historyLoaded = true;
        autoScroll(elements.messagesArea);
      } catch (error) {
        // History is helpful but not required for a new chat turn.
        renderWelcomeIfEmpty();
      } finally {
        historyLoading = false;
      }
    }

    // Toggle panel open/close
    elements.button.addEventListener('click', () => {
      elements.panel.classList.add('docmind-open');
      loadHistory();
      setTimeout(() => elements.messageInput.focus(), 0);
    });

    elements.closeButton.addEventListener('click', () => {
      elements.panel.classList.remove('docmind-open');
    });

    // Send message handler
    async function sendMessage() {
      const message = elements.messageInput.value.trim();

      if (!message) return;

      removePreviewWelcome();

      // Add user message
      elements.messagesArea.appendChild(addMessage(message, 'user'));
      elements.messageInput.value = '';
      elements.sendButton.disabled = true;

      // Show loading indicator
      const loadingMessage = showLoadingIndicator();
      elements.messagesArea.appendChild(loadingMessage);
      autoScroll(elements.messagesArea);

      try {
        // Send to API
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: PROJECT_ID,
            message,
          }),
        });

        // Remove loading indicator
        loadingMessage.remove();

        if (!response.ok) {
          let detail = '';
          try {
            const errorData = await response.json();
            detail = errorData && errorData.detail ? String(errorData.detail) : '';
          } catch (parseError) {
            detail = '';
          }
          throw new Error(detail || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // Add assistant message
        elements.messagesArea.appendChild(addMessage(data.answer, 'assistant'));
      } catch (error) {
        // Remove loading indicator
        loadingMessage.remove();

        // Show error message
        let errorMsg = 'Something went wrong. Please check the chatbot setup and try again.';
        if (error && error.message) {
          if (error.message.includes('reported as leaked')) {
            errorMsg = 'The provider rejected this API key because it was reported as leaked. Revoke it, create a new key, update the chatbot setup, and try again.';
          } else if (error.message.includes('Missing API key')) {
            errorMsg = 'This chatbot is missing a provider API key. Add a valid key in setup or configure the provider key on the backend.';
          } else if (error.message.includes('No relevant document context')) {
            errorMsg = 'No searchable document content was found for this chatbot. Upload at least one website knowledge file and try again.';
          } else if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
            errorMsg = 'The Gemini API key was rejected. Paste a valid key from Google AI Studio and try again.';
          } else if (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
            errorMsg = 'The provider quota or rate limit was reached. Try again later or use another key.';
          } else if (error.message.includes('model')) {
            errorMsg = 'The provider rejected the configured model name. Check the chatbot setup and try again.';
          }
        }
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
