let ws;
let unreadCounts = {};  // contactId => number of unread messages
let currentChatUser = null;  // currently open chat user

// === 1. Helper to trigger events easily ===
function triggerEvent(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

// === 2. Listen for core events ===

// When a new message is received (from WS or offline)
document.addEventListener("messageReceived", (e) => {
  const { senderId, message, timestamp } = e.detail;

  if (Number(currentChatUser) === Number(senderId)) {
    // Show in the chat window
    displayMessage("them", message, timestamp);
    saveMessageLocally(senderId, "them", message, timestamp);
  } else {
    // Not in this chat → increment unread count
    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    updateUnreadBadge(senderId);
    saveMessageLocally(senderId, "them", message, timestamp);
  }
});

// When the contact list is loaded
document.addEventListener("contactsLoaded", (e) => {
  const contacts = e.detail.contacts;
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  contacts.forEach(contact => {
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
      document.getElementById(`lastmsg-${contact.contact_id}`).innerText = lastmsg.message;
    }
  });
});

// When the last message of a chat is updated!
document.addEventListener("lastMessageUpdated", (e) => {
  const { contactId, message } = e.detail;

  // Find the last-msg element for this contact
  const lastMsgElement = document.querySelector(`#lastmsg-${contactId}`);

  if (lastMsgElement) {
    lastMsgElement.innerText = message;
  } else {
    console.warn(`No last-msg element for contact ${contactId}`);
    // Optional: If the contact isn’t in the list, you could trigger a refresh
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
        message: data.message,
        timestamp: Date.now()
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
function sendMessage(contactId) {
  const input = document.getElementById("message-input");
  const message = input.value.trim();
  if (!message) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("❌ WebSocket not open yet!");
    return;
  }

  // Save + show immediately
  saveMessageLocally(contactId, "me", message);
  displayMessage("me", message);
  input.value = "";

  // Send via WebSocket
  ws.send(JSON.stringify({
    type: "message",
    receiver_id: contactId,
    message: message
  }));

  // Emit "messageSent" event in case you want notifications, etc.
  triggerEvent("messageSent", { contactId, message });
}

// === The add contact function
async function addContact() {
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

async function openChatWith(contactId, displayname, username) {
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
}
function clearConversationLocally(contactId) {
  localStorage.removeItem(`chat_user_${contactId}`);
}

// === 8. Bootstrapping ===
document.addEventListener("DOMContentLoaded", () => {
  hideStatusBarBackButton();
  requireAuth();
  loadContacts();          // will emit contactsLoaded
  loadOfflineMessages();   // will emit messageReceived for each
  connectWebSocket();
});

window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});

