// frontend/chat/websocket.js
// Manages the WebSocket connection, including sending and receiving real-time messages.
// It attaches its functions to the 'app.websocket' namespace.

(function (app) {
  /**
   * Establishes a connection to the WebSocket server.
   */
  function connectWebSocket() {
    const token = getCookie("auth_token");
    if (!token) {
      console.error(
        "Authentication token not found. Cannot connect WebSocket.",
      );
      return;
    }

    setConnectionStatus("CONNECTING...", "default");
    app.state.ws = new WebSocket(WS_URL);

    // Once connected, register the client with its auth token.
    app.state.ws.onopen = () => {
      setConnectionStatus("CONNECTED!", "connected");
      app.state.ws.send(JSON.stringify({ type: "register", token: token }));
    };

    // When a message arrives, trigger the global message handler event.
    app.state.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        app.events.trigger("messageReceived", {
          senderId: data.from,
          payload: data.payload,
        });
      }
    };

    app.state.ws.onclose = () =>
      setConnectionStatus("DISCONNECTED!", "disconnected");
    app.state.ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setConnectionStatus("Connection error!", "disconnected");
    };
  }

  /**
   * Encrypts and sends a message to a contact via WebSocket.
   * @param {number} contactId - The ID of the recipient.
   */
  async function sendMessage(contactId) {
    return new Promise(async (resolve, reject) => {
      const input = document.getElementById("message-input");
      const message = input.value.trim();
      if (!message) {
        return reject(new Error("Empty message!"));
      }

      if (!app.state.ws || app.state.ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not open yet!");
        if (navigator.vibrate) {
          navigator.vibrate(200); // Vibrate for 200 milliseconds
        }

        const statusIcon = document.querySelector(".status-icon");
        if (statusIcon) {
          statusIcon.classList.add("shake");
          setTimeout(() => statusIcon.classList.remove("shake"), 500);
        }
        return reject(new Error("Websocket disconnected!"));
      }

      const recipientPublicKeyJwk = app.state.publicKeyCache[contactId];
      if (!recipientPublicKeyJwk) {
        alert(
          "Cannot find the public key for this user. They may need to log in again to publish their key.",
        );
        return reject(new Error("Cannot find public key!"));
      }

      // E2EE Encryption Flow
      const recipientPublicKey = await cryptoHandler.importPublicKeyFromJwk(
        recipientPublicKeyJwk,
      );
      const aesKey = await cryptoHandler.generateAesKey();
      const { ciphertext, iv } = await cryptoHandler.aesEncrypt(
        message,
        aesKey,
      );
      const exportedAesKeyJwk = await cryptoHandler.exportKeyToJwk(aesKey);
      const encryptedAesKey = await cryptoHandler.rsaEncrypt(
        new TextEncoder().encode(JSON.stringify(exportedAesKeyJwk)),
        recipientPublicKey,
      );

      const payload = {
        ciphertext: cryptoHandler.arrayBufferToBase64(ciphertext),
        encryptedKey: cryptoHandler.arrayBufferToBase64(encryptedAesKey),
        iv: cryptoHandler.arrayBufferToBase64(iv),
        timestamp: Date.now(),
      };

      // Update local UI immediately.
      app.storage.saveMessageLocally(
        contactId,
        "me",
        message,
        payload.timestamp,
      );
      app.ui.displayMessage("me", message, payload.timestamp);
      input.value = "";

      // Send the encrypted payload.
      app.state.ws.send(
        JSON.stringify({
          type: "message",
          receiver_id: contactId,
          payload: payload,
        }),
      );
      app.events.trigger("messageSent", { contactId, message });
      resolve();
    });
  }

  // Expose functions on the global app object.
  app.websocket.connect = connectWebSocket;
  app.websocket.send = sendMessage;
})(app);
