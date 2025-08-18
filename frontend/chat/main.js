// frontend/chat/main.js
// This is the main entry point for the chat application.
// It orchestrates the initialization process.

(function (app) {
  /**
   * Opens a chat window with a specific contact.
   * @param {Object} contact - The contact object.
   */
  function openChatWith(contact) {
    showStatusBarBackButton(app.ui.goBackToList);
    document.getElementById("messages").innerHTML = "";
    document.getElementById("chat-title").textContent = contact.display_name;
    document.getElementById("chat-subtitle").textContent =
      "@" + contact.username;
    document.getElementById("chat-view").classList.add("active");
    document.getElementById("chat-list").classList.add("hidden");

    const messages = app.storage.getLocalMessages(contact.id);
    console.log(messages);
    messages.forEach((m) =>
      app.ui.displayMessage(m.sender, m.message, m.timestamp),
    );

    app.state.currentChatUser = contact.id;
    // Clear unread count for this chat.
    app.state.unreadCounts[contact.id] = 0;
    app.ui.updateUnreadBadge(contact.id);

    // Set up the send button for this specific chat.
    const sendButton = document.getElementById("send-button");
    const messageInput = document.getElementById("message-input");

    const sendMessageAction = async () => {
      sendButton.disabled = true;
      await app.websocket.send(contact.id);
      sendButton.disabled = false;
      messageInput.focus();
    };

    sendButton.onclick = sendMessageAction;

    // Allow sending with Enter key
    messageInput.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessageAction();
      }
    };
  }

  /**
   * Initializes the modals for adding new contacts.
   */
  function initAddContactModals() {
    // This function is large and self-contained, so it's pasted here directly.
    // It has been modified to use the app object, e.g., app.api.loadContacts().
    const openBtn = document.getElementById("add-contact-btn");
    const overlay = document.getElementById("modal-overlay");
    const addContactModal = document.getElementById("add-contact-modal");
    const closeAddContactBtn = document.getElementById(
      "close-add-contact-modal",
    );
    const searchInput = document.getElementById("user-search-input");
    const searchResultsContainer = document.getElementById("search-results");
    const profileModal = document.getElementById("profile-view-modal");
    const closeProfileBtn = document.getElementById("close-profile-modal");
    const profileContent = document.getElementById("profile-content");

    function openAddContactModal() {
      addContactModal.classList.remove("hidden");
      overlay.classList.remove("hidden");
      searchInput.focus();
    }

    function closeAddContactModal() {
      addContactModal.classList.add("hidden");
      overlay.classList.add("hidden");
      searchInput.value = "";
      searchResultsContainer.innerHTML =
        '<p class="search-results-placeholder">Start typing to find users.</p>';
    }

    function openProfileModal(user) {
      const useravatar = user.profile_picture_url
        ? `<img src="/${user.profile_picture_url}" class="profile-avatar">`
        : `<div class="profile-avatar">${user.display_name.charAt(0).toUpperCase()}</div>`;
      profileContent.innerHTML = `
            ${useravatar}
            <h3>${user.display_name}</h3>
            <p class="username">@${user.username}</p>
            <p class="bio">${user.bio || "No bio provided."}</p>
            <button id="add-user-btn" data-username="${user.username}" class="button button-success">
                Add to Contacts
            </button>
            <button id="message-user-btn" class="button">Message</button>
        `;
      profileModal.classList.remove("hidden");

      document.getElementById("add-user-btn").onclick = (e) => {
        addContact(e.target.getAttribute("data-username"));
      };
      document.getElementById("message-user-btn").onclick = () => {
        // This is a new user, add their key to the cache
        if (user.public_key) {
          app.state.publicKeyCache[user.id] = JSON.parse(user.public_key);
        }
        openChatWith({
          id: user.id,
          display_name: user.display_name,
          username: user.username,
        });
        closeProfileModal();
        closeAddContactModal();
      };
      if (
        app.state.allContacts.some(
          (contact) => Number(contact.id) === Number(user.id),
        )
      ) {
        document.getElementById("add-user-btn").classList.add("hidden");
      }
    }

    function closeProfileModal() {
      profileModal.classList.add("hidden");
    }

    async function searchUsers(query) {
      if (query.length < 2) {
        searchResultsContainer.innerHTML =
          '<p class="search-results-placeholder">Keep typing...</p>';
        return;
      }
      searchResultsContainer.innerHTML =
        '<p class="search-results-placeholder">Searching...</p>';
      const token = getCookie("auth_token");
      const res = await fetch(API + "search_users.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, query }),
      });
      const data = await res.json();
      if (data.success) {
        displaySearchResults(data.users);
      } else {
        searchResultsContainer.innerHTML = `<p class="search-results-placeholder">Error: ${data.error}</p>`;
      }
    }

    function displaySearchResults(users) {
      if (users.length === 0) {
        searchResultsContainer.innerHTML =
          '<p class="search-results-placeholder">No users found.</p>';
        return;
      }
      searchResultsContainer.innerHTML = "";
      users.forEach((user) => {
        const userCard = document.createElement("div");
        userCard.className = "contact-card";
        const contactavatar = user.profile_picture_url
          ? `<img src="/${user.profile_picture_url}" class="contact-avatar">`
          : `<div class="contact-avatar">${user.display_name.charAt(0).toUpperCase()}</div>`;
        userCard.innerHTML = `
                ${contactavatar}
                <div class="contact-info">
                    <div class="contact-name">${user.display_name}</div>
                    <div class="contact-username">@${user.username}</div>
                </div>
            `;
        userCard.onclick = () => openProfileModal(user);
        searchResultsContainer.appendChild(userCard);
      });
    }

    function debounce(func, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    }

    const debouncedSearch = debounce(searchUsers, 300);

    async function addContact(username) {
      const token = getCookie("auth_token");
      const res = await fetch(API + "add_contact.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username }),
      });
      const data = await res.json();
      if (data.success) {
        closeProfileModal();
        closeAddContactModal();
        app.api.loadContacts(); // Refresh the main contact list
      } else {
        alert("Failed to add contact: " + data.error);
      }
    }

    openBtn.addEventListener("click", openAddContactModal);
    closeAddContactBtn.addEventListener("click", closeAddContactModal);
    closeProfileBtn.addEventListener("click", closeProfileModal);
    overlay.addEventListener("click", () => {
      closeAddContactModal();
      closeProfileModal();
    });
    searchInput.addEventListener("input", (e) =>
      debouncedSearch(e.target.value),
    );
  }

  /**
   * The main function to start the application.
   */
  async function main() {
    // Ensure user is authenticated before proceeding.
    await requireAuth();

    // Load the user's decrypted private key from local storage.
    const privateKeyJwkString = localStorage.getItem("decrypted_private_key");
    if (!privateKeyJwkString) {
      alert("Your private key is missing. Please log out and log back in.");
      return;
    }
    const privateKeyJwk = JSON.parse(privateKeyJwkString);
    app.state.myPrivateKey =
      await cryptoHandler.importPrivateKeyFromJwk(privateKeyJwk);

    // Set up all event listeners and UI components.
    app.events.initialize();
    initAddContactModals();

    // Fetch initial data and connect to the real-time server.
    await app.api.loadContacts();
    await app.api.loadOfflineMessages();
    app.websocket.connect();
  }

  // Expose necessary functions to the global app object.
  app.init.main = main;
  app.init.openChatWith = openChatWith;

  // Add the event listener to prevent accidental reloads.
  window.addEventListener("beforeunload", (e) => {
    e.preventDefault();
    e.returnValue = "";
  });

  // Run the application once the DOM is fully loaded.
  document.addEventListener("DOMContentLoaded", app.init.main);
})(app);
