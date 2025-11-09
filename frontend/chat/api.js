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
  async function fetchOfflineMessages() {
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

  async function fetchAllMessages() {
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
          console.log(data);
          for (const msg of data.messages) {
            const contactId =
              msg.sender_id == app.state.myUserId
                ? msg.receiver_id
                : msg.sender_id;
            const sender = msg.sender_id == app.state.myUserId ? "me" : "them";
            const payload = JSON.parse(msg.payload);
            let decryptedPayload;

            if (
              msg.message_type === "text" ||
              msg.message_type === "forward-text"
            ) {
              try {
                if (!app.state.myPrivateKey)
                  throw new Error("Private key not loaded.");
                const myKeyData = payload.keys.find(
                  (k) => Number(k.userId) === Number(app.state.myUserId),
                );
                if (!myKeyData)
                  throw new Error("No key found for this user in the payload.");

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
                const aesKey = await app.crypto.importAesKeyFromJwk(aesKeyJwk);
                decryptedPayload = await app.crypto.aesDecrypt(
                  ciphertext,
                  aesKey,
                  iv,
                );
              } catch (error) {
                console.error("Decryption failed during history load:", error);
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
              msg.status,
              timestamp_parsed,
              msg.message_type,
            );
          }
        } else {
          console.error("Failed to fetch all messages:", data.error);
        }
      });
  }

  // Expose functions on the global app object.
  app.api.loadContacts = loadContacts;
  app.api.fetchOfflineMessages = fetchOfflineMessages;
  app.api.fetchAllMessages = fetchAllMessages;
})(app);
