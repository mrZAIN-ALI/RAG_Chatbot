# DocMind Embeddable Widget

Vanilla JavaScript chat widget that can be embedded on any website.

## Installation

1. Include the widget script on your page:

```html
<script src="https://your-api.com/widget.js?id=YOUR_PROJECT_ID"></script>
```

Replace `YOUR_PROJECT_ID` with your DocMind project ID.

## Optional Configuration

Configure the widget via `window.DocMindConfig` before loading the script:

```html
<script>
  window.DocMindConfig = {
    apiBase: "https://api.example.com",  // Defaults to script origin
    primaryColor: "#6366f1"              // Defaults to indigo
  };
</script>
<script src="https://your-api.com/widget.js?id=YOUR_PROJECT_ID"></script>
```

## Features

- **Floating Button**: Click to open/close chat interface
- **Embedded Chat Panel**: 380x560px fixed panel with message history
- **Credential Fields**: Provider, model, and API key inputs (stored in sessionStorage)
- **Message History**: Scrollable message area with user/assistant separation
- **Loading Indicator**: Animated dots while awaiting response
- **Auto-scroll**: Automatically scrolls to latest message
- **Error Handling**: User-friendly error messages
- **Style Isolation**: All CSS scoped with `.docmind-` prefix to prevent conflicts

## UI Elements

### Floating Button
- Fixed position bottom-right
- 60x60px circle
- Customizable color via `primaryColor` config
- Emoji: 💬

### Chat Panel
- 380x560px fixed panel
- Hidden by default
- Opens when button is clicked
- Closes on close button or when minimized

### Credential Section
- Provider field (gemini/openai/groq)
- Model field (e.g. gemini-2.0-flash)
- API Key field (password input, not displayed)
- Collapsed after first successful message
- Credentials persisted in `sessionStorage`

### Message Area
- Scrollable message history
- User messages: right-aligned, colored bubbles
- Assistant messages: left-aligned, gray bubbles
- Error messages: red-tinted bubbles

### Input Row
- Text input with placeholder "Type your message..."
- Send button (disabled when input empty)
- Enter key to send, Shift+Enter for newline

## API Integration

Sends POST requests to `{apiBase}/api/chat` with:

```json
{
  "project_id": "YOUR_PROJECT_ID",
  "message": "User message",
  "provider": "gemini",
  "model": "gemini-2.0-flash",
  "api_key": "user_api_key"
}
```

Expected response:
```json
{
  "answer": "Assistant response",
  "confidence": 0.95
}
```

## Browser Support

- Chrome, Firefox, Safari, Edge (modern versions)
- No external dependencies
- No jQuery required
- Works in Shadow DOM and iframes

## Development

### Testing

```bash
npm install
npm test
```

Runs Jest tests in jsdom environment.

### Files

- `widget.js` - Main widget implementation (~800 lines)
- `widget.test.js` - Jest test suite (~500 lines)
- `package.json` - NPM dependencies

## Technical Details

### Style Isolation
All CSS uses `.docmind-` prefix to prevent conflicts with host page styles. Single `<style>` tag injected into document head.

### Credentials Management
- Stored in `sessionStorage` under key: `docmind_credentials_{PROJECT_ID}`
- Format: `{ provider, model, apiKey }`
- Loaded on widget initialization
- Updated after each successful message

### Error Handling
- Network errors: "Something went wrong. Please check your API key and model name."
- HTTP errors: Same message
- Validation errors: "Please fill in all credentials (provider, model, API key)."

### Performance
- IIFE (Immediately Invoked Function Expression) prevents global namespace pollution
- Event delegation minimizes DOM listeners
- CSS animations use CSS transforms (hardware accelerated)
- Lazy message rendering

## License

MIT
