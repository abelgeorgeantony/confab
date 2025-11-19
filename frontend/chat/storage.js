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
    messageId,
    clientMessageId,
    contactId,
    sender,
    payload,
    msgStatus = "pending",
    timestamp = Date.now(),
    messageType = "text",
  ) {
    if (messageId === null) {
      messageId = 0;
    }
    if (clientMessageId === null) {
      clientMessageId = 0;
    }
    const key = `chat_user_${contactId}`;
    let messages = JSON.parse(localStorage.getItem(key)) || [];
    // Store the full message object
    messages.push({
      messageId,
      clientMessageId,
      sender,
      messageType,
      payload,
      timestamp,
      msgStatus,
    });
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

  function updateClientMessageId(
    chatId,
    clientMessageId,
    messageId,
    messageStatus,
  ) {
    const key = `chat_user_${chatId}`;
    const messages = JSON.parse(localStorage.getItem(key)) || [];

    const messageIndex = messages.findIndex(
      (msg) => msg.clientMessageId === clientMessageId,
    );
    if (messageIndex !== -1) {
      messages[messageIndex].messageId = messageId;
      messages[messageIndex].clientMessageId = 0;
      messages[messageIndex].msgStatus = messageStatus;
      localStorage.setItem(key, JSON.stringify(messages));
      if (chatId === app.state.currentChatUser) {
        const element = document.querySelector(
          '[data-message_id="' + clientMessageId + '"]',
        );
        element.dataset.message_id = messageId;
        const statusSpan = element.querySelector(".message-status");
        if (messageStatus === "pending") {
          statusSpan.textContent = "sending";
        } else if (messageStatus === "queued") {
          statusSpan.textContent = "check";
        } else if (messageStatus === "delivered") {
          statusSpan.textContent = "check check";
        } else if (messageStatus === "read") {
          statusSpan.textContent = "Read";
        }
      }
    }
  }

  function updateMessageStatus(chatId, messageId, messageStatus) {
    const key = `chat_user_${chatId}`;
    const messages = JSON.parse(localStorage.getItem(key)) || [];

    const messageIndex = messages.findIndex(
      (msg) => Number(msg.messageId) === Number(messageId),
    );
    if (messageIndex !== -1) {
      messages[messageIndex].msgStatus = messageStatus;
      localStorage.setItem(key, JSON.stringify(messages));
      if (Number(chatId) === Number(app.state.currentChatUser)) {
        const element = document.querySelector(
          '[data-message_id="' + messageId + '"]',
        );
        const statusSpan = element.querySelector(".message-status");
        if (messageStatus === "pending") {
          statusSpan.textContent = "sending";
        } else if (messageStatus === "queued") {
          statusSpan.textContent = "check";
        } else if (messageStatus === "delivered") {
          statusSpan.textContent = "check check";
        } else if (messageStatus === "read") {
          statusSpan.textContent = "check check";
          statusSpan.classList.add("read");
        }
      }
    }
  }

  function deleteLocalMessage(chatId, messageId) {
    const key = `chat_user_${chatId}`;
    const messages = JSON.parse(localStorage.getItem(key)) || [];

    const messageIndex = messages.findIndex(
      (msg) => Number(msg.messageId) === Number(messageId),
    );
    console.log(messages);
    console.log(messageId);
    console.log(messageIndex + "Hi");
    if (messageIndex !== -1) {
      messages.splice(messageIndex, 1);
      localStorage.setItem(key, JSON.stringify(messages));
    }
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
  app.storage.updateClientMessageId = updateClientMessageId;
  app.storage.updateMessageStatus = updateMessageStatus;
  app.storage.deleteLocalMessage = deleteLocalMessage;
  app.storage.getLocalMessages = getLocalMessages;
  app.storage.getLastMessage = getLastMessage;
})(app);
