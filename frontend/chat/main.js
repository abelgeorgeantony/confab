// frontend/chat/main.js
// This is the main entry point for the chat application.
// It orchestrates the initialization process.

(function (app) {
  /**
   * Initializes the modals for adding new contacts.
   */
  function initAddContactModals() {
    // --- Modal Elements ---
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

    // --- Modal State Manager (Z-Index Approach) ---
    const modalStack = [];

    function openModal(modalElement) {
      if (!modalElement) return;

      if (modalStack.length > 0) {
        modalStack[modalStack.length - 1].classList.remove("modal-top");
      }

      modalStack.push(modalElement);
      modalElement.classList.add("modal-top");
      modalElement.classList.remove("hidden");
      overlay.classList.remove("hidden");
    }

    function closeCurrentModal() {
      if (modalStack.length === 0) return;

      const modalToClose = modalStack.pop();
      modalToClose.classList.add("hidden");
      modalToClose.classList.remove("modal-top");

      if (modalStack.length > 0) {
        modalStack[modalStack.length - 1].classList.add("modal-top");
      }

      if (modalStack.length === 0) {
        overlay.classList.add("hidden");
      }
    }

    // --- Modal Specific Logic ---

    function openAddContact() {
      openModal(addContactModal);
      searchInput.focus();
    }

    function closeAddContactModal() {
      searchInput.value = "";
      searchResultsContainer.innerHTML =
        '<p class="search-results-placeholder">Start typing to find users.</p>';
      closeCurrentModal();
    }

    function openProfile(user) {
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
      openModal(profileModal);

      document.getElementById("add-user-btn").onclick = (e) => {
        addContact(e.target.getAttribute("data-username"));
      };
      document.getElementById("message-user-btn").onclick = () => {
        if (user.public_key) {
          app.state.publicKeyCache[user.id] = JSON.parse(user.public_key);
        }
        app.ui.openChatWith(user);
        while (modalStack.length > 0) closeCurrentModal();
      };

      if (user.status === "contact") {
        document.getElementById("add-user-btn").classList.add("hidden");
      }
      if (Number(app.state.currentChatUser) === Number(user.id)) {
        document.getElementById("message-user-btn").classList.add("hidden");
      }
    }

    function closeProfileModal() {
      // No specific cleanup needed for profile modal yet
      closeCurrentModal();
    }

    async function addContact(username) {
      const token = getCookie("auth_token");
      const res = await fetch(API + "add_contact.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username }),
      });
      const data = await res.json();
      if (data.success) {
        while (modalStack.length > 0) closeCurrentModal();
        app.api.loadContacts();
      } else {
        alert("Failed to add contact: " + data.error);
      }
    }

    // --- Search Logic ---
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
        userCard.onclick = () => openProfile(user);
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

    // --- Event Listeners ---
    openBtn.addEventListener("click", openAddContact);
    closeAddContactBtn.addEventListener("click", closeAddContactModal);
    closeProfileBtn.addEventListener("click", closeProfileModal);
    overlay.addEventListener("click", closeCurrentModal);
    searchInput.addEventListener("input", (e) =>
      debouncedSearch(e.target.value),
    );

    openProfileOf = (contact) => {
      openProfile(contact);
    };
  }

  /**
   * The main function to start the application.
   */
  async function main() {
    // Ensure user is authenticated before proceeding.
    Loader.start("Checking if you are a terrorist");
    const myId = await requireAuth();

    // Fetch and store user's own public key
    const token = getCookie("auth_token");
    const formData = new URLSearchParams();
    formData.append("token", token);
    await fetch(API + "fetch_my_profile.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    })
      .then((res) => {
        if (!res.ok) {
          console.error("Fetch failed with status:", res.status);
          res.text().then((text) => console.error("Response body:", text));
          throw new Error("Network response was not ok.");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          app.state.myPublicKey = JSON.parse(data.profile.public_key);
        } else {
          console.error("Failed to fetch own profile:", data.error);
          alert(
            "There was an error fetching your profile information. Please try logging in again.",
          );
          // Redirect to login?
        }
      });

    // Load the user's decrypted private key from local storage.
    Loader.addMessage("Selling your private key");
    const privateKeyJwkString = localStorage.getItem("decrypted_private_key");
    if (!privateKeyJwkString) {
      alert("Your private key is missing. Please log out and log back in.");
      return;
    }
    const privateKeyJwk = JSON.parse(privateKeyJwkString);
    app.state.myPrivateKey =
      await app.crypto.importPrivateKeyFromJwk(privateKeyJwk);

    // Set up all event listeners and UI components.
    app.events.initialize();
    initAddContactModals();

    // Fetch initial data and connect to the real-time server.
    Loader.addMessage("Tickling your friends");
    await app.api.loadContacts();

    // Fetch all messages if no chat history is found in local storage
    let hasChatHistory = false;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i).startsWith("chat_user_")) {
        hasChatHistory = true;
        break;
      }
    }

    if (hasChatHistory) {
      Loader.addMessage("Reading your unread messages");
      await app.api.loadOfflineMessages();
    } else if (!hasChatHistory) {
      if (!myId) {
        console.error("User ID not set, cannot fetch history.");
        return;
      }

      console.log(
        "No chat history found in local storage, fetching from server...",
      );
      Loader.addMessage("Loading your messages");
      const historyToken = getCookie("auth_token");
      const historyFormData = new URLSearchParams();
      historyFormData.append("token", historyToken);

      await fetch(API + "fetch_all_messages.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: historyFormData,
      })
        .then((res) => {
          if (!res.ok) {
            console.error("Fetch failed with status:", res.status);
            res.text().then((text) => console.error("Response body:", text));
            throw new Error("Network response was not ok.");
          }
          return res.json();
        })
        .then(async (data) => {
          if (data.success) {
            for (const msg of data.messages) {
              const contactId =
                msg.sender_id == myId ? msg.receiver_id : msg.sender_id;
              const sender = msg.sender_id == myId ? "me" : "them";
              const payload = JSON.parse(msg.payload);
              let decryptedPayload;

              if (msg.message_type === "text") {
                try {
                  if (!app.state.myPrivateKey)
                    throw new Error("Private key not loaded.");
                  const myKeyData = payload.keys.find(
                    (k) => Number(k.userId) === Number(myId),
                  );
                  if (!myKeyData)
                    throw new Error(
                      "No key found for this user in the payload.",
                    );

                  const encryptedKey = app.crypto.base64ToArrayBuffer(
                    myKeyData.key,
                  );
                  const iv = app.crypto.base64ToArrayBuffer(payload.iv);
                  const ciphertext = app.crypto.base64ToArrayBuffer(
                    payload.ciphertext,
                  );
                  const decryptedAesKeyData = await app.crypto.rsaDecrypt(
                    encryptedKey,
                    app.state.myPrivateKey,
                  );
                  const aesKeyJwk = JSON.parse(
                    new TextDecoder().decode(decryptedAesKeyData),
                  );
                  const aesKey =
                    await app.crypto.importAesKeyFromJwk(aesKeyJwk);
                  decryptedPayload = await app.crypto.aesDecrypt(
                    ciphertext,
                    aesKey,
                    iv,
                  );
                } catch (error) {
                  console.error(
                    "Decryption failed during history load:",
                    error,
                  );
                  decryptedPayload = "🔒 [Could not decrypt message]";
                }
              } else {
                // For voice, image, etc., the payload from the DB is already what we want to store.
                decryptedPayload = payload;
              }

              const dateString = msg.created_at; // ISO 8601 formatted date string
              const timestamp_parsed = Date.parse(dateString);
              app.storage.saveMessageLocally(
                msg.id,
                null,
                contactId,
                sender,
                decryptedPayload,
                timestamp_parsed,
                msg.message_type,
              );
            }
          } else {
            console.error("Failed to fetch all messages:", data.error);
          }
        });
    }

    Loader.addMessage("Waking up the carrier pigeon");
    app.websocket.connect();
    app.ui.goBackToList();
    setTimeout(
      () => Loader.addMessage("Smuggling-in your friend's photos"),
      500,
    );
    document.addEventListener("profilePicturesReady", async () => {
      Loader.stop();
    });
  }

  // Expose necessary functions to the global app object.
  app.init.main = main;
  //app.init.openChatWith = openChatWith;

  // Add the event listener to prevent accidental reloads.
  window.addEventListener("beforeunload", (e) => {
    e.preventDefault();
    e.returnValue = "";
  });

  // Run the application once the DOM is fully loaded.
  document.addEventListener("DOMContentLoaded", app.init.main);
})(app);
