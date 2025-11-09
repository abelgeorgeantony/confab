// frontend/chat/ui.js
// Manages all direct interactions with the DOM, like displaying messages and updating UI elements.
// It attaches its functions to the 'app.ui' namespace.

(function (app) {
  /**
   * Switches the view from the chat window back to the contact list on mobile.
   */
  function goBackToList() {
    if (app.state.currentChatUser) {
      // Save the current chat's UI state to cache
      app.state.chatState[app.state.currentChatUser] = {
        textDraft: document.getElementById("message-input").value,
        voiceDraft: null,
        scrollPosition: document.getElementById("messages").scrollTop,
      };
    }
    console.log(app.state.chatState);
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
   * Checks if a chat UI cache exists for a given contact ID.
   * @param {number} contactId - The ID of the contact.
   * @returns {boolean} - True if a cache exists, false otherwise.
   */
  function chatCacheExists(contactId) {
    return !!app.state.chatState[contactId];
  }

  function addDateHeader(date) {
    const dateContainer = document.createElement("div");
    dateContainer.classList.add("message-date-container");
    const dateElement = document.createElement("span");
    dateElement.classList.add("message-date");

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let dateText = "1000 years from now";
    if (date.toLocaleDateString() === today.toLocaleDateString()) {
      dateText = "Today";
    } else if (date.toLocaleDateString() === yesterday.toLocaleDateString()) {
      dateText = "Yesterday";
    } else {
      dateText =
        date.toLocaleDateString("en-US", { weekday: "short" }) +
        ", " +
        date.toLocaleDateString();
    }

    dateElement.textContent = dateText;
    dateContainer.appendChild(dateElement);
    document.getElementById("messages").appendChild(dateContainer);
  }

  /**
   * Opens a chat window with a specific contact.
   * @param {Object} contact - The contact object.
   */
  function openChatWith(contact) {
    console.log(contact);
    if (Number(contact.id) === Number(app.state.currentChatUser)) {
      return;
    }
    if (app.state.currentChatUser) {
      // Save the current chat's UI state to cache
      app.state.chatState[app.state.currentChatUser] = {
        textDraft: document.getElementById("message-input").value,
        voiceDraft: null,
        scrollPosition: document.getElementById("messages").scrollTop,
      };
    }
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
    let pastMessageDate = null;
    messages.forEach((m) => {
      const currentMessageDate = new Date(m.timestamp);
      if (pastMessageDate === null) {
        addDateHeader(currentMessageDate);
      } else if (pastMessageDate.getDate() < currentMessageDate.getDate()) {
        addDateHeader(currentMessageDate);
      }
      displayMessage(
        m.messageId,
        m.sender,
        m.payload,
        m.msgStatus,
        m.timestamp,
        m.messageType,
      );
      pastMessageDate = currentMessageDate;
    });

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
      const clientMessageId = app.crypto.generateClientMessageId();
      displayMessage(clientMessageId, "me", textMessage);
      await app.websocket.sendTextMessage(contact.id, clientMessageId);
      app.storage.saveMessageLocally(
        null,
        clientMessageId,
        contact.id,
        "me",
        textMessage,
      );
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

    if (chatCacheExists(contact.id)) {
      messageInput.value = app.state.chatState[contact.id].textDraft;
      document.getElementById("messages").scrollTop =
        app.state.chatState[contact.id].scrollPosition - 148;
    } else {
      messageInput.value = "";
    }
    document.querySelectorAll(".opened").forEach((element) => {
      element.classList.remove("opened");
    });
    document
      .getElementById("user-list")
      .querySelector(`[data-contact-id="${contact.id}"]`)
      .classList.add("opened");
    showStatusBarBackButton(goBackToList);
  }

  /**
   * Creates and appends a new message bubble to the chat window.
   * @param {string} sender - Who sent the message ('me' or 'them').
   * @param {string} messageText - The content of the message.
   * @param {number} [timestamp=Date.now()] - The message timestamp.
   */
  function displayMessage(
    messageId,
    sender,
    content,
    messageStatus,
    timestamp = Date.now(),
    messageType = "text",
  ) {
    const messagesContainer = document.getElementById("messages");
    const msgDiv = document.createElement("div");
    const forwardedSpan = document.createElement("span");
    forwardedSpan.classList.add("forwarded-indicator");
    forwardedSpan.textContent = "Forwarded Message";
    if (messageType === "forward-text" || messageType === "forward-voice") {
      msgDiv.appendChild(forwardedSpan);
    }
    msgDiv.classList.add("message", sender === "me" ? "outgoing" : "incoming");

    if (messageType === "voice" || messageType === "forward-voice") {
      const placeholder = document.createElement("div");
      placeholder.classList.add("message-text", "voice-placeholder");
      placeholder.textContent = "Loading voice message...";
      msgDiv.appendChild(placeholder);

      decryptAndCreateAudioPlayer(content, sender) // content is the pointer payload
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
    }

    const msgFooter = document.createElement("div");
    msgFooter.classList.add("message-footer");

    const timeSpan = document.createElement("span");
    timeSpan.classList.add("message-time");
    const date = new Date(timestamp);
    timeSpan.textContent = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    msgFooter.appendChild(timeSpan);
    if (sender === "me") {
      const statusSpan = document.createElement("span");
      statusSpan.classList.add("material-icons");
      statusSpan.classList.add("message-status");
      if (messageStatus === "pending") {
        statusSpan.textContent = "sending";
      } else if (messageStatus === "queued") {
        statusSpan.textContent = "check";
      } else if (messageStatus === "delivered") {
        statusSpan.textContent = "check check";
      } else if (messageStatus === "read") {
        statusSpan.textContent = "check check";
      }
      msgFooter.appendChild(statusSpan);
    }
    msgDiv.appendChild(msgFooter);
    msgDiv.dataset.message_id = messageId;
    msgDiv.dataset.message_type = messageType;
    enableLongPress(msgDiv, content);

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Decrypts a voice message payload and creates an HTML audio player.
   * @param {object} payload - The voice message pointer payload {url, key, iv}.
   * @returns {Promise<HTMLAudioElement>} A promise that resolves to the audio element.
   */
  async function decryptAndCreateAudioPlayer(payload, sender) {
    // 1. Decrypt the entire voice payload using the crypto utility
    const decryptedWavBuffer = await app.crypto.decryptVoicePayload(
      payload,
      app.state.myPrivateKey,
    );

    // 2. Create audio player from the decrypted buffer
    const wavBlob = new Blob([decryptedWavBuffer], { type: "audio/wav" });
    const audioUrl = URL.createObjectURL(wavBlob);
    /*const audioPlayer = document.createElement("audio");
    audioPlayer.classList.add("voice-message-player");
    audioPlayer.controls = true;
    audioPlayer.src = audioUrl;

    return audioPlayer;*/

    // 3. Create a container for the Wavesurfer player and its controls
    const playerWrapper = document.createElement("div");
    playerWrapper.classList.add("voice-message-player-wrapper"); // Custom wrapper for styling

    const mainElementsWrapper = document.createElement("div");
    mainElementsWrapper.classList.add("voice-message-main-elements-wrapper");

    // Create the Play/Pause button
    const playPauseBtn = document.createElement("button");
    playPauseBtn.type = "button";
    playPauseBtn.classList.add(
      "material-icons",
      "voice-message-play-pause-btn",
    );
    playPauseBtn.textContent = "play_arrow"; // Initial state: play

    // Create the waveform container
    const waveformContainer = document.createElement("div");
    waveformContainer.classList.add("voice-message-waveform-container"); // Container for Wavesurfer

    // Create the timer display
    const timerSpan = document.createElement("span");
    timerSpan.classList.add("voice-message-timer");
    timerSpan.textContent = "0:00 / 0:00"; // Initial timer display

    // Append elements to the wrapper
    mainElementsWrapper.appendChild(playPauseBtn);
    mainElementsWrapper.appendChild(waveformContainer);
    playerWrapper.appendChild(mainElementsWrapper);
    playerWrapper.appendChild(timerSpan);

    // Get computed styles for consistent theming
    const computedStyle = getComputedStyle(document.documentElement);
    let waveColor = "#ffffff"; // Default wave color
    let progressColor = "#ffffff"; // Default progress color

    if (sender === "me") {
      // Outgoing message styling
      waveColor = "var(--outgoing-message-wave-color)";
      progressColor = "var(--outgoing-message-progress-color)";
      playPauseBtn.style.backgroundColor = "var(--outgoing-play-pause-btn-bg";
      playPauseBtn.style.color = computedStyle
        .getPropertyValue("--outgoing-play-pause-btn-color")
        .trim();
    } else {
      // Incoming message styling
      waveColor = "var(--incoming-message-wave-color)";
      progressColor = "var(--incoming-message-progress-color)";
      playPauseBtn.style.backgroundColor = computedStyle
        .getPropertyValue("--incoming-play-pause-btn-bg")
        .trim();
      playPauseBtn.style.color = computedStyle
        .getPropertyValue("--incoming-play-pause-btn-color")
        .trim();
    }

    // 4. Initialize Wavesurfer.js
    const wavesurferInstance = WaveSurfer.create({
      container: waveformContainer,
      waveColor: waveColor,
      progressColor: progressColor,
      height: 40, // Adjust height to fit message bubble
      barWidth: 2,
      barGap: 1,
      dragToSeek: true,
      //cursorColor: "transparent", // Hide default cursor
      interact: true, // Allow interaction with the waveform
    });

    // 5. Load the audio into Wavesurfer.js
    wavesurferInstance.load(audioUrl);

    // 6. Attach event listeners for playback controls and Wavesurfer events
    playPauseBtn.onclick = () => {
      wavesurferInstance.playPause();
    };

    wavesurferInstance.on("play", () => {
      playPauseBtn.textContent = "pause";
    });

    wavesurferInstance.on("pause", () => {
      playPauseBtn.textContent = "play_arrow";
    });

    wavesurferInstance.on("timeupdate", (currentTime) => {
      const duration = wavesurferInstance.getDuration();
      const currentMinutes = Math.floor(currentTime / 60);
      const currentSeconds = Math.floor(currentTime % 60);
      const totalMinutes = Math.floor(duration / 60);
      const totalSeconds = Math.floor(duration % 60);

      timerSpan.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, "0")} / ${totalMinutes}:${totalSeconds.toString().padStart(2, "0")}`;
    });

    wavesurferInstance.on("ready", (duration) => {
      const totalMinutes = Math.floor(duration / 60);
      const totalSeconds = Math.floor(duration % 60);
      timerSpan.textContent = `0:00 / ${totalMinutes}:${totalSeconds.toString().padStart(2, "0")}`;
    });

    wavesurferInstance.on("finish", () => {
      playPauseBtn.textContent = "play_arrow";
      wavesurferInstance.seekTo(0); // Reset to beginning
      wavesurferInstance.fireEvent("timeupdate", 0); // Manually update timer to 0:00
    });

    // Important: Clean up Blob URL when Wavesurfer is destroyed or the element is removed.
    // This part is crucial for memory management.
    // We'll attach a mutation observer to the parent to detect removal.
    // For simplicity now, we'll rely on the browser's eventual cleanup,
    // but in a production app, more robust lifecycle management is needed.
    // A robust solution would involve a MutationObserver to detect when playerWrapper is removed from DOM
    // and then call wavesurferInstance.destroy() and URL.revokeObjectURL(audioUrl);

    return playerWrapper;
  }

  function openForwardMessageModal(msgDiv, msgText) {
    console.log("openForwardMessageModal");
    const modal = document.getElementById("forward-message-modal");
    const contactList = document.getElementById("forward-contact-list");
    const forwardContent = document.getElementById("forward-message-input");
    const sendForwardBtn = document.getElementById("send-forward-message-btn");
    const modalCloseBtn = document.getElementById("forward-message-close-btn");

    console.log("Hi");
    contactList.innerHTML = "";
    app.state.allContacts.forEach((contact) => {
      const contactDiv = document.createElement("div");
      contactDiv.className = "forward-list-contact-card";
      contactDiv.setAttribute("data-contact-id", contact.id);
      const useravatar = contact.profile_picture_url
        ? `<img src="/${contact.profile_picture_url}" class="contact-avatar" data-contact-id="${contact.id}">`
        : `<div class="contact-avatar">${contact.username.charAt(0).toUpperCase()}</div>`;
      contactDiv.innerHTML = `
        <div class="forward-list-contact-info">
        ${useravatar}
            <div class="contact-name">${contact.display_name}</div>
        </div>
        <input type="checkbox" class="forward-checkbox" data-contact-id="${contact.id}">
      `;
      contactDiv.onclick = () => {
        const checkbox = contactDiv.querySelector(".forward-checkbox");
        if (checkbox.checked) {
          checkbox.checked = false;
        } else {
          checkbox.checked = true;
        }
      };

      contactList.appendChild(contactDiv);
    });

    if (
      msgDiv.dataset.message_type === "text" ||
      msgDiv.dataset.message_type === "forward-text"
    ) {
      forwardContent.value = msgText;
    } else if (
      msgDiv.dataset.message_type === "voice" ||
      msgDiv.dataset.message_type === "forward-voice"
    ) {
      forwardContent.value = "Voice Message";
    }
    modal.classList.remove("hidden");

    sendForwardBtn.onclick = () => {
      console.log("Send button clicked");
      const checkedContacts = Array.from(
        document.querySelectorAll(".forward-checkbox:checked"),
      );
      if (checkedContacts.length > 0) {
        const selectedContacts = checkedContacts.map(
          (checkbox) => checkbox.dataset.contactId,
        );
        if (msgDiv.dataset.message_type === "text") {
          app.websocket.forwardMessage(selectedContacts, msgText);
        } else {
          const key = `chat_user_${app.state.currentChatUser}`;
          const messages = JSON.parse(localStorage.getItem(key)) || [];
          const messageIndex = messages.findIndex(
            (msg) =>
              Number(msg.messageId) === Number(msgDiv.dataset.message_id),
          );
          if (messageIndex !== -1) {
            const audio_payload = messages[messageIndex].payload;
            selectedContacts.forEach(async (contactId) => {
              await app.events.sendVoiceMessage(true, audio_payload, contactId);
            });
          }
        }
        document.getElementById("forward-message-close-btn").click();
      }
    };
    modalCloseBtn.onclick = () => {
      modal.classList.add("hidden");
      document.getElementById("modal-overlay").classList.add("hidden");
      contactList.innerHTML = "";
    };
  }

  /**
   * Enables the long-press gesture on a message bubble to show actions.
   * @param {HTMLElement} msgDiv - The message bubble element.
   * @param {string} messageText - The text content of the message.
   */
  function enableLongPress(msgDiv, messageText) {
    let pressTimer;

    const showPopup = () => {
      console.log(msgDiv);
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
      const deleteBtn = document.getElementById("delete-message-btn");
      deleteBtn.onclick = async () => {
        try {
          const auth_token = getCookie("auth_token");
          const response = await fetch(API + "delete_message.php", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messageId: msgDiv.dataset.message_id,
              token: auth_token,
            }),
          });

          const data = await response.json();
          console.log(data + response);
          if (response.ok) {
            // Check if HTTP status is 2xx
            console.log("Message deleted successfully:", data.message);
            app.storage.deleteLocalMessage(
              app.state.currentChatUser,
              msgDiv.dataset.message_id,
            );
            msgDiv.remove();
          } else {
            console.error("Failed to delete message:", data.message);
            alert("Error deleting message: " + data.message);
          }
        } catch (error) {
          console.error("Network or server error:", error);
          alert("An unexpected error occurred. Please try again.");
        }
        popup.classList.add("hidden");
        overlay.classList.add("hidden");
      };
      const forwardBtn = document.getElementById("forward-message-btn");
      forwardBtn.addEventListener("click", () => {
        document.getElementById("modal-overlay").classList.remove("hidden");
        openForwardMessageModal(msgDiv, messageText);
        popup.classList.add("hidden");
        overlay.classList.add("hidden");
      });
      const editBtn = document.getElementById("edit-message-btn");

      if (
        msgDiv.dataset.message_type === "voice" ||
        msgDiv.dataset.message_type === "forward-voice"
      ) {
        copyBtn.classList.add("hidden");
        editBtn.classList.add("hidden");
      } else if (
        msgDiv.dataset.message_type === "text" ||
        msgDiv.dataset.message_type === "forward-text"
      ) {
        copyBtn.classList.remove("hidden");
        editBtn.classList.add("hidden");
      }

      const clickOutsideHandler = (event) => {
        console.log(event.target);
        if (
          event.target === overlay ||
          event.target === document.getElementById("status-bar-back-btn") ||
          event.target ===
            document
              .getElementById("status-bar-back-btn")
              .querySelector("span") ||
          event.target === document.getElementById("add-contact-btn")
        ) {
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
