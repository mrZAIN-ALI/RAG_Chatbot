/**
 * DocMind Widget Tests - Integration Tests (FIXED FOR JSDOM)
 * Run with: npm test
 * 
 * These tests verify widget functionality with increased async timeouts
 * for jsdom environment compatibility.
 */

const fs = require('fs');

describe('DocMind Widget', () => {
  let widgetCode;
  let mockFetch;

  beforeAll(() => {
    // Read the widget code once
    widgetCode = fs.readFileSync(__dirname + '/widget.js', 'utf8');
  });

  beforeEach(() => {
    // Reset DOM
    document.documentElement.innerHTML = '';
    document.body.innerHTML = '';

    // Clear sessionStorage
    sessionStorage.clear();

    // Mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Create script tag for widget.js with project_id query param
    const scriptTag = document.createElement('script');
    scriptTag.src = 'http://localhost:3000/widget.js?id=test-project-123';
    document.head.appendChild(scriptTag);

    // Execute widget code in jsdom context
    const script = document.createElement('script');
    script.textContent = widgetCode;
    document.body.appendChild(script);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Widget Initialization', () => {
    test('should inject floating button into DOM on load', () => {
      const button = document.querySelector('.docmind-button');
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('💬');
    });

    test('should inject chat panel into DOM on load', () => {
      const panel = document.querySelector('.docmind-panel');
      expect(panel).toBeTruthy();
    });

    test('chat panel should be hidden by default', () => {
      const panel = document.querySelector('.docmind-panel');
      expect(panel.classList.contains('docmind-open')).toBe(false);
    });

    test('should inject styles into document head', () => {
      const style = document.querySelector('style');
      expect(style).toBeTruthy();
      expect(style.textContent).toContain('docmind-button');
      expect(style.textContent).toContain('docmind-panel');
    });

    test('should inject header with title and close button', () => {
      const header = document.querySelector('.docmind-header');
      expect(header).toBeTruthy();
      expect(header.textContent).toContain('DocMind Assistant');
      expect(header.querySelector('.docmind-close-button')).toBeTruthy();
    });
  });

  describe('Panel Open/Close', () => {
    test('panel should open on button click', () => {
      const button = document.querySelector('.docmind-button');
      const panel = document.querySelector('.docmind-panel');

      button.click();
      expect(panel.classList.contains('docmind-open')).toBe(true);
    });

    test('panel should close on close button click', () => {
      const button = document.querySelector('.docmind-button');
      const closeButton = document.querySelector('.docmind-close-button');
      const panel = document.querySelector('.docmind-panel');

      button.click();
      expect(panel.classList.contains('docmind-open')).toBe(true);

      closeButton.click();
      expect(panel.classList.contains('docmind-open')).toBe(false);
    });
  });

  describe('Credential Fields', () => {
    test('should have provider input field', () => {
      const input = document.querySelector('.docmind-provider-input');
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('gemini/openai/groq');
    });

    test('should have model input field', () => {
      const input = document.querySelector('.docmind-model-input');
      expect(input).toBeTruthy();
      expect(input.placeholder).toContain('gemini-2.0-flash');
    });

    test('should have API key password input field', () => {
      const input = document.querySelector('.docmind-apikey-input');
      expect(input).toBeTruthy();
      expect(input.type).toBe('password');
      expect(input.placeholder).toBe('Your API key');
    });

    test('credentials section should be visible initially', () => {
      const credentials = document.querySelector('.docmind-credentials');
      expect(credentials).toBeTruthy();
      expect(credentials.classList.contains('docmind-collapsed')).toBe(false);
    });
  });

  describe('Message Input and Send Button', () => {
    test('send button should be disabled when input is empty', () => {
      const sendButton = document.querySelector('.docmind-send-button');
      const messageInput = document.querySelector('.docmind-message-input');

      messageInput.value = '';
      messageInput.dispatchEvent(new Event('input'));

      expect(sendButton.disabled).toBe(true);
    });

    test('send button should be enabled when input has text', () => {
      const sendButton = document.querySelector('.docmind-send-button');
      const messageInput = document.querySelector('.docmind-message-input');

      messageInput.value = 'Hello';
      messageInput.dispatchEvent(new Event('input'));

      expect(sendButton.disabled).toBe(false);
    });

    test('message input should have placeholder text', () => {
      const messageInput = document.querySelector('.docmind-message-input');
      expect(messageInput.placeholder).toBe('Type your message...');
    });

    test('send button should have correct text', () => {
      const sendButton = document.querySelector('.docmind-send-button');
      expect(sendButton.textContent).toBe('Send');
    });
  });

  describe('Message Sending', () => {
    test('should call fetch with correct URL on send', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');

      messageInput.value = 'Hello';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Hi there', confidence: 0.9 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.any(Object)
      );
    }, 10000);

    test('should send correct request body', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');

      messageInput.value = 'Test message';
      providerInput.value = 'openai';
      modelInput.value = 'gpt-3.5-turbo';
      apikeyInput.value = 'sk-test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.95 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.project_id).toBe('test-project-123');
      expect(callBody.message).toBe('Test message');
      expect(callBody.provider).toBe('openai');
      expect(callBody.model).toBe('gpt-3.5-turbo');
      expect(callBody.api_key).toBe('sk-test-key');
    }, 10000);

    test('should display user message in chat', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const messagesArea = document.querySelector('.docmind-messages');

      messageInput.value = 'Hello World';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.9 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const userMessage = messagesArea.querySelector('.docmind-user .docmind-message-bubble');
      expect(userMessage).toBeTruthy();
      expect(userMessage.textContent).toBe('Hello World');
    }, 10000);

    test('should display assistant message after response', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const messagesArea = document.querySelector('.docmind-messages');

      messageInput.value = 'Test';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'This is the assistant response', confidence: 0.95 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const assistantMessages = messagesArea.querySelectorAll('.docmind-assistant .docmind-message-bubble');
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      expect(lastMessage.textContent).toBe('This is the assistant response');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should display error message on fetch failure', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const messagesArea = document.querySelector('.docmind-messages');

      messageInput.value = 'Test';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const errorMessages = messagesArea.querySelectorAll('.docmind-error .docmind-message-bubble');
      expect(errorMessages.length).toBeGreaterThan(0);
      const lastError = errorMessages[errorMessages.length - 1];
      expect(lastError.textContent).toContain('Something went wrong');
    }, 10000);

    test('should display error on invalid HTTP response', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const messagesArea = document.querySelector('.docmind-messages');

      messageInput.value = 'Test';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const errorMessages = messagesArea.querySelectorAll('.docmind-error .docmind-message-bubble');
      expect(errorMessages.length).toBeGreaterThan(0);
    }, 10000);

    test('should display error when credentials missing', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const messagesArea = document.querySelector('.docmind-messages');

      messageInput.value = 'Test';

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const errorMessages = messagesArea.querySelectorAll('.docmind-error .docmind-message-bubble');
      expect(errorMessages.length).toBeGreaterThan(0);
    }, 5000);
  });

  describe('Keyboard Interaction', () => {
    test('Enter key should send message', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');

      messageInput.value = 'Test message';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.9 }),
      });

      const event = new KeyboardEvent('keypress', { key: 'Enter' });
      messageInput.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(mockFetch).toHaveBeenCalled();
    }, 10000);

    test('Shift+Enter should not send message', async () => {
      const messageInput = document.querySelector('.docmind-message-input');

      messageInput.value = 'Test message';
      mockFetch.mockClear();

      const event = new KeyboardEvent('keypress', { key: 'Enter', shiftKey: true });
      messageInput.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Session Storage', () => {
    test('should save credentials after successful message', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');

      messageInput.value = 'Hello';
      providerInput.value = 'groq';
      modelInput.value = 'llama3-8b';
      apikeyInput.value = 'gsk-1234567890';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.9 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const stored = JSON.parse(sessionStorage.getItem('docmind_credentials_test-project-123'));
      expect(stored).toBeTruthy();
      expect(stored.provider).toBe('groq');
      expect(stored.model).toBe('llama3-8b');
      expect(stored.apiKey).toBe('gsk-1234567890');
    }, 10000);
  });

  describe('UI State Management', () => {
    test('should clear message input after sending', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');

      messageInput.value = 'Hello';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.9 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(messageInput.value).toBe('');
    }, 10000);

    test('should collapse credentials after first message', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const credentials = document.querySelector('.docmind-credentials');

      messageInput.value = 'Hello';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.9 }),
      });

      expect(credentials.classList.contains('docmind-collapsed')).toBe(false);

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(credentials.classList.contains('docmind-collapsed')).toBe(true);
    }, 10000);

    test('should auto-scroll messages area', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');
      const messagesArea = document.querySelector('.docmind-messages');

      messageInput.value = 'Hello';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Response', confidence: 0.9 }),
      });

      sendButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(messagesArea.scrollTop >= messagesArea.scrollHeight - 20).toBe(true);
    }, 10000);

    test('should disable send button while fetching', async () => {
      const messageInput = document.querySelector('.docmind-message-input');
      const providerInput = document.querySelector('.docmind-provider-input');
      const modelInput = document.querySelector('.docmind-model-input');
      const apikeyInput = document.querySelector('.docmind-apikey-input');
      const sendButton = document.querySelector('.docmind-send-button');

      messageInput.value = 'Hello';
      providerInput.value = 'gemini';
      modelInput.value = 'gemini-2.0-flash';
      apikeyInput.value = 'test-key';

      mockFetch.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ answer: 'Response', confidence: 0.9 }),
            });
          }, 100);
        })
      );

      sendButton.click();
      expect(sendButton.disabled).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(sendButton.disabled).toBe(false);
    }, 10000);
  });
});