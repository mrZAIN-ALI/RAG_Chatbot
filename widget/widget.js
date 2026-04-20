/**
 * DocMind Widget - Embedded Chat Interface
 * 
 * This widget provides an embeddable chat interface that can be
 * integrated into external websites.
 * 
 * Usage:
 *   <script src="https://api.example.com/widget.js"></script>
 *   <div id="docmind-widget" data-project-id="your-project-id"></div>
 * 
 * @version 1.0.0
 */

(function() {
  "use strict";

  // Placeholder for widget initialization
  window.DocMindWidget = {
    version: "1.0.0",
    
    /**
     * Initialize the embedded chat widget
     * @param {Object} options - Configuration options
     */
    init: function(options) {
      console.log("DocMind Widget initialized", options);
      // TODO: Implement widget initialization
    },

    /**
     * Send a message to the chat API
     * @param {string} message - User message
     */
    sendMessage: function(message) {
      console.log("Sending message:", message);
      // TODO: Implement message sending
    },

    /**
     * Load chat history
     * @param {string} projectId - Project ID
     */
    loadHistory: function(projectId) {
      console.log("Loading history for project:", projectId);
      // TODO: Implement history loading
    },
  };

  // Auto-initialize if div with id="docmind-widget" exists
  document.addEventListener("DOMContentLoaded", function() {
    var widget = document.getElementById("docmind-widget");
    if (widget) {
      var projectId = widget.getAttribute("data-project-id");
      if (projectId) {
        window.DocMindWidget.init({ projectId: projectId });
      }
    }
  });

})();
