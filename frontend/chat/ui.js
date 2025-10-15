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
      if (sender === "me") {
        // For our own sent voice messages, create a player from the Base64 Data URL
        const audioPlayer = document.createElement("audio");
        audioPlayer.classList.add("voice-message-player");
        audioPlayer.controls = true;
        audioPlayer.src = content.dataUrl;
        msgDiv.appendChild(audioPlayer);
      } else {
        // For incoming voice messages, decrypt and create the player
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
      }
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
    console.log(contactElement);
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
  app.ui.displayMessage = displayMessage;
  app.ui.updateUnreadBadge = updateUnreadBadge;
})(app);
