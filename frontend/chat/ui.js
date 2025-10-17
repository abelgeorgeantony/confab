// frontend/chat/ui.js
// Manages all direct interactions with the DOM, like displaying messages and updating UI elements.
// It attaches its functions to the 'app.ui' namespace.

(function (app) {
  /**
   * Switches the view from the chat window back to the contact list on mobile.
   */
  function goBackToList() {
    document.getElementById("chat-view-cover").classList.remove("hidden");
    hideStatusBarBackButton();
    document.getElementById("chat-view").classList.remove("active");
    document.getElementById("chat-list").classList.remove("slideout");
    document.getElementById("messages").innerHTML = "";
    document.getElementById("chat-view-avatar").classList.add("hideavatar");
    document.getElementById("chat-title").textContent = "Select a chat";
    document.getElementById("chat-subtitle").textContent =
      "or add a new contact to start messaging!";
    document.getElementById("send-button").onclick = async () => {
      console.log("No chat selected!");
    };
    app.state.currentChatUser = null;
  }
  /**
   * Navigates the user to their profile page.
   */
  function goToProfile() {
    window.location.href = "../profile/profile.html";
  }

  /**
   * Opens a chat window with a specific contact.
   * @param {Object} contact - The contact object.
   */
  function openChatWith(contact) {
    showStatusBarBackButton(goBackToList);
    document.getElementById("chat-view-cover").classList.add("hidden");
    document.getElementById("messages").innerHTML = "";
    const avatarContainer = document.getElementById("chat-view-avatar");
    if (contact.profile_picture_url) {
      avatarContainer.innerHTML = `<img src="/${contact.profile_picture_url}" alt="${contact.display_name}">`;
    } else {
      avatarContainer.innerHTML = `<div>${contact.username.charAt(0).toUpperCase()}</div>`;
    }
    avatarContainer.classList.remove("hideavatar");
    document.getElementById("chat-title").textContent = contact.display_name;
    document.getElementById("chat-subtitle").textContent =
      "@" + contact.username;
    document.getElementById("chat-view").classList.add("active");
    document.getElementById("chat-list").classList.add("slideout");

    const messages = app.storage.getLocalMessages(contact.id);
    messages.forEach((m) =>
      displayMessage(m.sender, m.payload, m.timestamp, m.messageType),
    );

    app.state.currentChatUser = contact.id;
    // Clear unread count for this chat.
    app.state.unreadCounts[contact.id] = 0;
    updateUnreadBadge(contact.id);

    // Make profile popup on header click
    document.getElementById("chat-view-header").onclick = () => {
      openProfileOf(contact);
    };

    // Set up the send button for this specific chat.
    const sendTextButton = document.getElementById("send-button");
    const recordButton = document.getElementById("record-button");
    const messageInput = document.getElementById("message-input");
    const voiceUiWrapper = document.getElementById("voice-ui-wrapper");

    const emojiButton = document.getElementById("emoji-button");
    const emojiPickerContainer = document.getElementById(
      "emoji-picker-container",
    );

    const updateButtonVisibility = () => {
      const isVoiceUIVisible = !voiceUiWrapper.classList.contains("hidden");
      const isInputEmpty = messageInput.value.trim() === "";
      const isEmojiPickerVisible =
        !emojiPickerContainer.classList.contains("hidden");

      if (isVoiceUIVisible) {
        sendTextButton.classList.add("hidden");
        recordButton.classList.add("hidden");
        emojiButton.classList.add("hidden");
      } else {
        emojiButton.classList.remove("hidden");
        if (isInputEmpty) {
          sendTextButton.classList.add("hidden");
          recordButton.classList.remove("hidden");
        } else {
          sendTextButton.classList.remove("hidden");
          recordButton.classList.add("hidden");
        }
      }
    };

    messageInput.oninput = updateButtonVisibility;
    updateButtonVisibility(); // Initial check

    emojiButton.onclick = () => {
      emojiPickerContainer.classList.toggle("hidden");
      updateButtonVisibility();
    };

    const emojiPicker = emojiPickerContainer.querySelector("emoji-picker");
    emojiPicker.addEventListener("emoji-click", (event) => {
      messageInput.value += event.detail.unicode;
      updateButtonVisibility();
    });

    // Hide emoji picker when clicking outside
    document.addEventListener("click", (event) => {
      if (
        !emojiPickerContainer.contains(event.target) &&
        !emojiButton.contains(event.target)
      ) {
        emojiPickerContainer.classList.add("hidden");
        updateButtonVisibility();
      }
    });

    const sendTextMessageAction = async () => {
      sendTextButton.disabled = true;
      const textMessage = messageInput.value;
      displayMessage("me", textMessage);
      await app.websocket.sendTextMessage(contact.id);
      app.storage.saveMessageLocally(contact.id, "me", textMessage);
      sendTextButton.disabled = false;
      updateButtonVisibility();
      //messageInput.focus();
    };
    sendTextButton.onclick = sendTextMessageAction;
    // Allow sending with Enter key
    messageInput.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendTextMessageAction();
      }
    };
  }

  /**
   * Creates and appends a new message bubble to the chat window.
   * @param {string} sender - Who sent the message ('me' or 'them').
   * @param {string} messageText - The content of the message.
   * @param {number} [timestamp=Date.now()] - The message timestamp.
   */
  function displayMessage(
    sender,
    content,
    timestamp = Date.now(),
    messageType = "text",
  ) {
    const messagesContainer = document.getElementById("messages");
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender === "me" ? "outgoing" : "incoming");

    if (messageType === "voice") {
      const placeholder = document.createElement("div");
      placeholder.classList.add("message-text", "voice-placeholder");
      placeholder.textContent = "Loading voice message...";
      msgDiv.appendChild(placeholder);

      decryptAndCreateAudioPlayer(content) // content is the pointer payload
        .then((audioPlayer) => {
          placeholder.replaceWith(audioPlayer);
        })
        .catch((error) => {
          console.error("Failed to load voice message:", error);
          placeholder.textContent = "Error: Could not load voice message.";
        });
    } else {
      // Handle text messages as before
      const textSpan = document.createElement("span");
      textSpan.classList.add("message-text");
      textSpan.textContent = content;
      msgDiv.appendChild(textSpan);

      // Only allow long-press on text messages for now
      enableLongPress(msgDiv, content);
    }

    const timeSpan = document.createElement("span");
    timeSpan.classList.add("message-time");
    timeSpan.textContent = new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    msgDiv.appendChild(timeSpan);

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Decrypts a voice message payload and creates an HTML audio player.
   * @param {object} payload - The voice message pointer payload {url, key, iv}.
   * @returns {Promise<HTMLAudioElement>} A promise that resolves to the audio element.
   */
  async function decryptAndCreateAudioPlayer(payload) {
    // 1. Decrypt the entire voice payload using the new crypto utility
    const decryptedWavBuffer = await app.crypto.decryptVoicePayload(
      payload,
      app.state.myPrivateKey,
    );

    // 2. Create audio player from the decrypted buffer
    const wavBlob = new Blob([decryptedWavBuffer], { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(wavBlob);
    const audioPlayer = document.createElement("audio");
    audioPlayer.classList.add("voice-message-player");
    audioPlayer.controls = true;
    audioPlayer.src = audioUrl;

    return audioPlayer;
  }

  /**
   * Enables the long-press gesture on a message bubble to show actions.
   * @param {HTMLElement} msgDiv - The message bubble element.
   * @param {string} messageText - The text content of the message.
   */
  function enableLongPress(msgDiv, messageText) {
    let pressTimer;

    const showPopup = () => {
      const popup = document.getElementById("message-actions-popup");
      const overlay = document.getElementById("message-actions-overlay");

      popup.classList.remove("hidden");
      overlay.classList.remove("hidden");

      const copyBtn = document.getElementById("copy-message-btn");
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(messageText);
        popup.classList.add("hidden");
        overlay.classList.add("hidden");
      };

      const clickOutsideHandler = (event) => {
        if (event.target === overlay) {
          popup.classList.add("hidden");
          overlay.classList.add("hidden");
          document.removeEventListener("click", clickOutsideHandler);
          document.removeEventListener("touchstart", clickOutsideHandler);
        }
      };

      document.addEventListener("click", clickOutsideHandler);
      document.addEventListener("touchstart", clickOutsideHandler);
    };

    const startPress = (e) => {
      if (e.button === 2) return;
      pressTimer = window.setTimeout(showPopup, 500);
    };

    const cancelPress = () => {
      clearTimeout(pressTimer);
    };

    msgDiv.addEventListener("mousedown", startPress);
    msgDiv.addEventListener("mouseup", cancelPress);
    msgDiv.addEventListener("mouseleave", cancelPress);
    msgDiv.addEventListener("touchstart", startPress);
    msgDiv.addEventListener("touchend", cancelPress);
    msgDiv.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /**
   * Updates the unread message count badge for a specific contact.
   * @param {number} senderId - The ID of the contact with unread messages.
   */
  function updateUnreadBadge(senderId) {
    const contactElement = document.querySelector(
      `[data-contact-id="${senderId}"]`,
    );
    if (!contactElement) return;

    let badge = contactElement.querySelector(".unread-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.classList.add("unread-badge");
      // A flex container is needed to properly align badge and info
      const infoContainer = contactElement.querySelector(".contact-info");
      contactElement.insertBefore(badge, infoContainer.nextSibling);
      badge = contactElement.querySelector(".unread-badge");
    }

    const count = app.state.unreadCounts[senderId];
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }

  // Expose functions on the global app object.
  app.ui.goBackToList = goBackToList;
  app.ui.goToProfile = goToProfile;
  app.ui.openChatWith = openChatWith;
  app.ui.displayMessage = displayMessage;
  app.ui.updateUnreadBadge = updateUnreadBadge;
})(app);
