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
    message,
    timestamp = Date.now(),
  ) {
    const key = `chat_user_${contactId}`;
    let messages = JSON.parse(localStorage.getItem(key)) || [];
    messages.push({ sender, message, timestamp });
    localStorage.setItem(key, JSON.stringify(messages));
    // Notify the app that this contact's last message has been updated.
    app.events.trigger("lastMessageUpdated", {
      contactId,
      sender,
      message,
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
