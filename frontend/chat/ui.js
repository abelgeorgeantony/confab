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
    window.location.href = "profile.html";
  }

  /**
   * Creates and appends a new message bubble to the chat window.
   * @param {string} sender - Who sent the message ('me' or 'them').
   * @param {string} messageText - The content of the message.
   * @param {number} [timestamp=Date.now()] - The message timestamp.
   */
  function displayMessage(sender, messageText, timestamp = Date.now()) {
    const messagesContainer = document.getElementById("messages");
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender === "me" ? "outgoing" : "incoming");

    const textSpan = document.createElement("span");
    textSpan.classList.add("message-text");
    textSpan.textContent = messageText;

    const timeSpan = document.createElement("span");
    timeSpan.classList.add("message-time");
    timeSpan.textContent = new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    msgDiv.appendChild(textSpan);
    msgDiv.appendChild(timeSpan);
    messagesContainer.appendChild(msgDiv);
    // Automatically scroll to the bottom to show the new message.
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
