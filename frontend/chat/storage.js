// frontend/chat/storage.js
// Contains helper functions, primarily for interacting with localStorage.
// It attaches its functions to the 'app.storage' namespace.

(function (app) {
  /**
   * Saves a message to the browser's local storage for a specific contact.
   * @param {number} contactId - The ID of the contact.
   * @param {string} sender - Who sent the message ('me' or 'them').
   * @param {string} message - The content of the message.
   * @param {number} [timestamp=Date.now()] - The message timestamp.
   */
  function saveMessageLocally(
    contactId,
    sender,
    payload,
    timestamp = Date.now(),
    messageType = "text",
  ) {
    const key = `chat_user_${contactId}`;
    let messages = JSON.parse(localStorage.getItem(key)) || [];
    // Store the full message object
    messages.push({ sender, messageType, payload, timestamp });
    localStorage.setItem(key, JSON.stringify(messages));

    // For the contact list preview, create a simple display message
    let messageForDisplay;
    switch (messageType) {
      case "voice":
        messageForDisplay = "🎤 Voice Message";
        break;
      case "text":
      default:
        messageForDisplay = payload; // For text, payload is the string
        break;
    }

    // Notify the app that this contact's last message has been updated.
    app.events.trigger("lastMessageUpdated", {
      contactId,
      sender,
      message: messageForDisplay,
      timestamp,
    });
  }

  /**
   * Retrieves all messages for a specific contact from local storage.
   * @param {number} contactId - The ID of the contact.
   * @returns {Array} An array of message objects.
   */
  function getLocalMessages(contactId) {
    return JSON.parse(localStorage.getItem(`chat_user_${contactId}`)) || [];
  }

  /**
   * Retrieves the most recent message for a contact from local storage.
   * @param {number} contactId - The ID of the contact.
   * @returns {Object|null} The last message object or null if none exists.
   */
  function getLastMessage(contactId) {
    const messages = JSON.parse(
      localStorage.getItem(`chat_user_${contactId}`) || "[]",
    );
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  // Expose these functions on the global app object.
  app.storage.saveMessageLocally = saveMessageLocally;
  app.storage.getLocalMessages = getLocalMessages;
  app.storage.getLastMessage = getLastMessage;
})(app);
