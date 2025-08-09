let ws;
let unreadCounts = {};  // contactId => number of unread messages
let currentChatUser = null;  // currently open chat user
let myPrivateKey = null;
let publicKeyCache = {};

// === 1. Helper to trigger events easily ===
function triggerEvent(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

// === 2. Listen for core events ===

// When a new message is received (from WS or offline)
document.addEventListener("messageReceived", async (e) => {
  const { senderId, payload } = e.detail;

  let decryptedMessage;
  try {
    // Ensure our private key is loaded and ready.
    if (!myPrivateKey) {
        console.error("Your private key is not loaded. Cannot decrypt messages.");
        // In a real app, you might prompt the user to log in again.
        return;
    }
    
    // --- DECRYPTION FLOW ---
    // 1. Decode the payload components from Base64 back into binary data.
    const encryptedKey = cryptoHandler.base64ToArrayBuffer(payload.encryptedKey);
    const iv = cryptoHandler.base64ToArrayBuffer(payload.iv);
    const ciphertext = cryptoHandler.base64ToArrayBuffer(payload.ciphertext);

    // 2. Decrypt the symmetric AES key using our private RSA key.
    const decryptedAesKeyData = await cryptoHandler.rsaDecrypt(encryptedKey, myPrivateKey);
    
    // We need to re-import the decrypted AES key to make it usable.
    const aesKeyJwk = JSON.parse(new TextDecoder().decode(decryptedAesKeyData));
    const aesKey = await cryptoHandler.importAesKeyFromJwk(aesKeyJwk); // Assumes importAesKeyFromJwk exists

    // 3. Decrypt the actual message content using the now-revealed AES key.
    decryptedMessage = await cryptoHandler.aesDecrypt(ciphertext, aesKey, iv);

  } catch (error) {
    console.error("Failed to decrypt message:", error);
    decryptedMessage = "🔒 [This message could not be decrypted]";
  }

  if (Number(currentChatUser) === Number(senderId)) {
    // Show in the chat window
    displayMessage("them", decryptedMessage, payload.timestamp);
    saveMessageLocally(senderId, "them", decryptedMessage, payload.timestamp);
  } else {
    // Not in this chat → increment unread count
    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    updateUnreadBadge(senderId);
    saveMessageLocally(senderId, "them", decryptedMessage, payload.timestamp);
  }
});

// When the contact list is loaded
document.addEventListener("contactsLoaded", (e) => {
  const contacts = e.detail.contacts;
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  const sortedContacts = contacts.map(contact => {
    if (contact.public_key) {
	publicKeyCache[contact.contact_id] = JSON.parse(contact.public_key);
    }
    const lastMessage = getLastMessage(contact.contact_id);
    // Add the timestamp to the contact object for sorting
    contact.lastMessageTimestamp = lastMessage ? lastMessage.timestamp : 0;
    return contact;
  }).sort((a, b) => {
    // Sort by timestamp in ascending order (newest first)
    return a.lastMessageTimestamp - b.lastMessageTimestamp;
  });

  sortedContacts.forEach(contact => {
    const contactDiv = document.createElement("div");
    contactDiv.classList.add("contact-card");
    contactDiv.innerHTML = `
      <div class="contact-avatar">${contact.username.charAt(0)}</div>
      <div class="contact-info">
        <div class="contact-name">${contact.display_name}</div>
        <div class="contact-lastmsg" id="lastmsg-${contact.contact_id}">Tap to chat</div>
      </div>
    `;
    contactDiv.setAttribute("data-contact-id", contact.contact_id);

    // Click → open chat
    contactDiv.onclick = () => openChatWith(contact.contact_id, contact.display_name, contact.username);

    list.appendChild(contactDiv);

    // Show last message if any
    const lastmsg = getLastMessage(contact.contact_id);
    if (lastmsg) {
      triggerEvent("lastMessageUpdated", { contactId: contact.contact_id, message: lastmsg.message});
    }
  });
});

// When the last message of a chat is updated!
document.addEventListener("lastMessageUpdated", (e) => {
  const { contactId, message } = e.detail;
    
  const userList = document.getElementById('user-list');
  
  const contactCard = userList.querySelector(`[data-contact-id="${contactId}"]`);

  if (contactCard) {
    const lastMsgElement = contactCard.querySelector('.contact-lastmsg');
    if (lastMsgElement) {
      lastMsgElement.innerText = message.replace(/[\n\r]/g, "");;
    }
    userList.insertBefore(contactCard, userList.firstChild);
  } else {
    console.warn(`No contact card found for contact ${contactId}`);
  }
});


// === 3. Core data loaders now only trigger events ===

async function loadContacts() {
  const token = getCookie("auth_token");
  const res = await fetch(API + "fetch_contacts.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  const data = await res.json();
  if (!data.valid) {
    console.error("Invalid token when fetching contacts");
    return;
  }

  // Instead of directly rendering UI → just emit event
  triggerEvent("contactsLoaded", { contacts: data.contacts });
}

async function loadOfflineMessages() {
  const token = getCookie("auth_token");
  const res = await fetch(API + "fetch_offline_messages.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  const data = await res.json();

  if (data.success && data.messages.length > 0) {
    data.messages.forEach(m => {
      // Emit event instead of calling handleIncomingMessage directly
      triggerEvent("messageReceived", {
        senderId: m.sender_id,
        message: m.message,
        timestamp: new Date(m.created_at).getTime()
      });
    });
  }
}

// === 4. WebSocket now only emits events ===
function connectWebSocket() {
  const token = getCookie("auth_token");
  if (!token) {
    console.error("No auth token, not connecting WS");
    return;
  }
  
  setConnectionStatus("CONNECTING...", "default");

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("✅ WebSocket connected");
    setConnectionStatus("CONNECTED!", "connected");
    ws.send(JSON.stringify({ type: "register", token: token }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      triggerEvent("messageReceived", {
        senderId: data.from,
        payload: data.payload
      });
    }
  };

  ws.onclose = () => {
    console.log("❌ WebSocket disconnected");
    setConnectionStatus("DISCONNECTED!", "disconnected");
  }
  ws.onerror = (err) => {
    console.error("WS Error:", err);
    setConnectionStatus("Connection error! Try reloading!!", "disconnected");
  }
}

// === 5. Sending messages → also emit event for UI consistency ===
async function sendMessage(contactId) {
  const input = document.getElementById("message-input");
  const message = input.value.trim();
  if (!message) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("❌ WebSocket not open yet!");
        if (navigator.vibrate) {
            navigator.vibrate(200); // Vibrate for 200 milliseconds
        }

        // 2. Shake the status icon
        const statusIcon = document.querySelector('.status-icon');
        if (statusIcon) {
            statusIcon.classList.add('shake');
            // Remove the class after the animation is done so it can be re-triggered
            setTimeout(() => {
                statusIcon.classList.remove('shake');
            }, 500); // Match the animation duration in CSS
        }
    return;
  }


  const recipientPublicKeyJwk = publicKeyCache[contactId];
  if (!recipientPublicKeyJwk) {
    alert("Could not find the public key for this contact. Cannot send message.");
    return;
  }
  const recipientPublicKey = await cryptoHandler.importPublicKeyFromJwk(recipientPublicKeyJwk);

  // 2. Generate a new, one-time symmetric AES key for this single message.
  const aesKey = await cryptoHandler.generateAesKey();

  // 3. Encrypt the message text with the AES key.
  const { ciphertext, iv } = await cryptoHandler.aesEncrypt(message, aesKey);

  // 4. Encrypt the AES key with the recipient's public RSA key.
  const exportedAesKeyJwk = await cryptoHandler.exportKeyToJwk(aesKey);
  const encryptedAesKey = await cryptoHandler.rsaEncrypt(
      new TextEncoder().encode(JSON.stringify(exportedAesKeyJwk)), 
      recipientPublicKey
  );

  // 5. Prepare the payload with Base64 encoded data for safe JSON transport.
  const payload = {
      ciphertext: cryptoHandler.arrayBufferToBase64(ciphertext),
      encryptedKey: cryptoHandler.arrayBufferToBase64(encryptedAesKey),
      iv: cryptoHandler.arrayBufferToBase64(iv),
      timestamp: Date.now()
  };

  saveMessageLocally(contactId, "me", message);
  displayMessage("me", message);
  input.value = "";

  // Send via WebSocket
  ws.send(JSON.stringify({
    type: "message",
    receiver_id: contactId,
    payload: payload
  }));

  // Emit "messageSent" event in case you want notifications, etc.
  triggerEvent("messageSent", { contactId, message });
}

// === The add contact function
/*async function addContact() {
  const username = document.getElementById("new-contact-username").value.trim();
  if (!username) {
    alert("Enter a username");
    return;
  }

  const token = getCookie("auth_token");

  const res = await fetch(API + "add_contact.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, username })
  });

  const data = await res.json();
  if (data.success) {
    alert("Contact "+username +" added!");
    document.getElementById("new-contact-username").value = "";
    hideAddContactForm();
    loadContacts(); // reload list
  } else {
    alert("Failed to add contact: " + data.error);
  }
}*/


// --- NEW: All logic for the "Add Contact" modals ---
function initAddContactModals() {
    // --- DOM Elements ---
    const openBtn = document.getElementById('add-contact-btn');
    const overlay = document.getElementById('modal-overlay');
    const addContactModal = document.getElementById('add-contact-modal');
    const closeAddContactBtn = document.getElementById('close-add-contact-modal');
    const searchInput = document.getElementById('user-search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const profileModal = document.getElementById('profile-view-modal');
    const closeProfileBtn = document.getElementById('close-profile-modal');
    const profileContent = document.getElementById('profile-content');
    //const toast = document.getElementById('toast');

    // --- Modal Control Functions ---
    function openAddContactModal() {
        addContactModal.classList.remove('hidden');
        addContactModal.classList.add('modal-enter');
        overlay.classList.remove('hidden');
    }

    function closeAddContactModal() {
        addContactModal.classList.add('hidden');
        overlay.classList.add('hidden');
        searchInput.value = '';
        searchResultsContainer.innerHTML = '<p class="search-results-placeholder">Start typing to find users.</p>';
    }

    function openProfileModal(user) {
        profileContent.innerHTML = `
            <div class="profile-avatar">${user.display_name.charAt(0)}</div>
            <h3>${user.display_name}</h3>
            <p class="username">@${user.username}</p>
            <p class="bio">${user.bio || 'No bio provided.'}</p>
            <button id="add-user-btn" data-username="${user.username}" class="button button-success">
                Add ${user.display_name.split(' ')[0]} to Contacts
            </button>
        `;
        profileModal.classList.remove('hidden');
        profileModal.classList.add('modal-enter');
        
        document.getElementById('add-user-btn').addEventListener('click', (e) => {
            const usernameToAdd = e.target.getAttribute('data-username');
            addContact(usernameToAdd);
        });
    }

    function closeProfileModal() {
        profileModal.classList.add('hidden');
    }

    // --- Core Logic Functions ---
    async function searchUsers(query) {
        if (query.length < 2) {
            searchResultsContainer.innerHTML = '<p class="search-results-placeholder">Keep typing to find users...</p>';
            return;
        }
        searchResultsContainer.innerHTML = '<p class="search-results-placeholder">Searching...</p>';
        
        const token = getCookie("auth_token");
        const res = await fetch(API + "search_users.php", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, query })
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
            searchResultsContainer.innerHTML = '<p class="search-results-placeholder">No users found.</p>';
            return;
        }
        searchResultsContainer.innerHTML = '';
        users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'contact-card';
            userCard.innerHTML = `
                <div class="contact-avatar">${user.display_name.charAt(0)}</div>
                <div class="contact-info">
                    <div class="contact-name">${user.display_name}</div>
                    <div class="contact-username">@${user.username}</div>
                </div>
            `;
            userCard.addEventListener('click', () => openProfileModal(user));
            searchResultsContainer.appendChild(userCard);
        });
    }
    
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const debouncedSearch = debounce(searchUsers, 300);

    async function addContact(username) {
        const token = getCookie("auth_token");
        const res = await fetch(API + "add_contact.php", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, username })
        });
        const data = await res.json();

        if (data.success) {
            closeProfileModal();
            closeAddContactModal();
            //showToast(`${username} has been added!`);
            loadContacts(); // Refresh the main contact list
        } else {
            alert("Failed to add contact: " + data.error);
        }
    }
    
    /*function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }*/

    // --- Event Listeners ---
    openBtn.addEventListener('click', openAddContactModal);
    closeAddContactBtn.addEventListener('click', closeAddContactModal);
    closeProfileBtn.addEventListener('click', closeProfileModal);
    overlay.addEventListener('click', () => {
        closeAddContactModal();
        closeProfileModal();
    });
    searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
}



// === 6. UI functions remain mostly the same ===
function goBackToList() {
  hideStatusBarBackButton();
  document.getElementById("chat-view").classList.remove("active");
  document.getElementById("chat-list").classList.remove("hidden");
  document.getElementById("messages").innerHTML = "";               document.getElementById("chat-title").textContent = "Select a chat";
  document.getElementById("chat-subtitle").textContent = "or add a new contact to start messaging!";
  currentChatUser = null;
}

function goToProfile() {
  window.location.replace("profile.html");
}

function showAddContactForm() {
  document.getElementById("add-contact-form").style.display = "block";
}

function hideAddContactForm() {
  document.getElementById("add-contact-form").style.display = "none";
  document.getElementById("new-contact-username").value = "";
}

function displayMessage(sender, messageText, timestamp = Date.now()) {
  const messagesContainer = document.getElementById("messages");

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message");
  msgDiv.classList.add(sender === "me" ? "outgoing" : "incoming");

  const textSpan = document.createElement("span");
  textSpan.classList.add("message-text");
  textSpan.textContent = messageText;

  const timeSpan = document.createElement("span");
  timeSpan.classList.add("message-time");
  timeSpan.textContent = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  msgDiv.appendChild(textSpan);
  msgDiv.appendChild(timeSpan);

  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateUnreadBadge(senderId) {
  const contactElement = document.querySelector(`[data-contact-id="${senderId}"]`);
  if (!contactElement) return; // later: auto-add non-contacts

  let badge = contactElement.querySelector(".unread-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.classList.add("unread-badge");
    contactElement.appendChild(badge);
  }

  badge.textContent = unreadCounts[senderId];
  badge.style.display = unreadCounts[senderId] > 0 ? "inline-block" : "none";
}

function openChatWith(contactId, displayname, username) {
  showStatusBarBackButton(goBackToList);
  document.getElementById("messages").innerHTML = "";
  document.getElementById("chat-title").textContent = displayname;
  document.getElementById("chat-subtitle").textContent = "@" + username;
  document.getElementById("chat-view").classList.add("active");
  document.getElementById("chat-list").classList.add("hidden");

  const messages = getLocalMessages(contactId);
  messages.forEach(m => displayMessage(m.sender, m.message, m.timestamp));

  unreadCounts[contactId] = 0;
  updateUnreadBadge(contactId);
  currentChatUser = contactId;
  document.getElementById("send-button").onclick = () => sendMessage(contactId);
}

// === 7. Local storage helpers unchanged ===
function saveMessageLocally(contactId, sender, message, timestamp = Date.now()) {
  const key = `chat_user_${contactId}`;
  let messages = JSON.parse(localStorage.getItem(key)) || [];
  messages.push({ sender, message, timestamp });
  localStorage.setItem(key, JSON.stringify(messages));
  triggerEvent("lastMessageUpdated", { contactId, message, timestamp });
}
function getLocalMessages(contactId) {
  return JSON.parse(localStorage.getItem(`chat_user_${contactId}`)) || [];
}
function getLastMessage(contactId) {
  const messages = JSON.parse(localStorage.getItem(`chat_user_${contactId}`) || "[]");
  return messages.length > 0 ? messages[messages.length - 1] : null;
}How to make the php built in web server use the certificates
function clearConversationLocally(contactId) {
  localStorage.removeItem(`chat_user_${contactId}`);
}

// === 8. Bootstrapping ===
document.addEventListener("DOMContentLoaded", async () => {
  hideStatusBarBackButton();
  await requireAuth();

  const privateKeyJwkString = localStorage.getItem('decrypted_private_key');
  const privateKeyJwk = JSON.parse(privateKeyJwkString);
  myPrivateKey = await cryptoHandler.importPrivateKeyFromJwk(privateKeyJwk);
  console.log("Private key loaded and ready.");
  loadContacts();          // will emit contactsLoaded
  loadOfflineMessages();   // will emit messageReceived for each
  connectWebSocket();
  initAddContactModals();
});

window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});

