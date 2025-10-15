// frontend/chat/api.js
// Handles all communication with the backend server via fetch requests.
// It attaches its functions to the 'app.api' namespace.

(function (app) {
  /**
   * Fetches the user's contact list from the backend.
   */
  async function loadContacts() {
    const token = getCookie("auth_token");
    const res = await fetch(API + "fetch_contacts.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!data.valid) {
      console.error("Invalid token when fetching contacts");
      return;
    }
    app.state.allContacts = data.contacts;
    app.events.trigger("contactsLoaded");
  }

  /**
   * Fetches any messages that were received while the user was offline.
   */
  async function loadOfflineMessages() {
    const token = getCookie("auth_token");
    const res = await fetch(API + "fetch_offline_messages.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (data.success && data.messages.length > 0) {
      data.messages.forEach((m) => {
        console.log("Processing offline message:", m); // Keep this for debugging
        app.events.trigger("messageReceived", {
          senderId: m.sender_id,
          message_type: m.message_type,
          payload: JSON.parse(m.payload),
        });
      });
    }
  }

  // Expose functions on the global app object.
  app.api.loadContacts = loadContacts;
  app.api.loadOfflineMessages = loadOfflineMessages;
})(app);
