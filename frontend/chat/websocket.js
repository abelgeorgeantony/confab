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
          message_type: data.message_type, // Pass the type
          payload: data.payload,
        });
      }
    };

    app.state.ws.onclose = () => {
      setConnectionStatus("DISCONNECTED!", "disconnected");
    };
    app.state.ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setConnectionStatus("Connection error!", "disconnected");
    };
  }

  /**
   * Sends a fully constructed message payload to a contact via WebSocket.
   * @param {number} contactId - The ID of the recipient.
   * @param {object} payload - The message payload (e.g., encrypted text or voice pointer).
   * @param {string} messageForDisplay - The text to display in the UI for this message.
   * @param {string} [messageType='text'] - The type of message.
   */
  async function send(
    contactId,
    payload,
    messageForDisplay,
    messageType = "text",
  ) {
    if (!app.state.ws || app.state.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open yet!");
      if (navigator.vibrate) navigator.vibrate(200);
      const statusIcon = document.querySelector(".status-icon");
      if (statusIcon) {
        statusIcon.classList.add("shake");
        setTimeout(() => statusIcon.classList.remove("shake"), 500);
      }
      throw new Error("Websocket disconnected!");
    }

    // Send the final payload to the server.
    app.state.ws.send(
      JSON.stringify({
        type: "message",
        receiver_id: contactId,
        message_type: messageType,
        payload: payload,
      }),
    );

    app.events.trigger("messageSent", {
      contactId,
      message: messageForDisplay,
    });
  }

  /**
   * Handles the specific logic for encrypting and sending a TEXT message.
   * @param {number} contactId - The ID of the recipient.
   */
  async function sendTextMessage(contactId) {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    const recipientPublicKeyJwk = app.state.publicKeyCache[contactId];
    if (!recipientPublicKeyJwk) {
      throw new Error("Cannot find public key for this user.");
    }

    const myPublicKeyJwk = app.state.myPublicKey;
    if (!myPublicKeyJwk) {
      throw new Error("Your own public key is not available.");
    }

    // E2EE Encryption Flow
    const recipientPublicKey = await app.crypto.importPublicKeyFromJwk(
      recipientPublicKeyJwk,
    );
    const myPublicKey = await app.crypto.importPublicKeyFromJwk(myPublicKeyJwk);
    const aesKey = await app.crypto.generateAesKey();
    const { ciphertext, iv } = await app.crypto.aesEncrypt(message, aesKey);
    const exportedAesKeyJwkString = JSON.stringify(
      await app.crypto.exportKeyToJwk(aesKey),
    );

    const encryptedAesKeyForReceiver = await app.crypto.rsaEncrypt(
      new TextEncoder().encode(exportedAesKeyJwkString),
      recipientPublicKey,
    );

    const encryptedAesKeyForSender = await app.crypto.rsaEncrypt(
      new TextEncoder().encode(exportedAesKeyJwkString),
      myPublicKey,
    );

    const payload = {
      ciphertext: app.crypto.arrayBufferToBase64(ciphertext),
      iv: app.crypto.arrayBufferToBase64(iv),
      keys: [
        {
          userId: contactId,
          key: app.crypto.arrayBufferToBase64(encryptedAesKeyForReceiver),
        },
        {
          userId: app.state.myId,
          key: app.crypto.arrayBufferToBase64(encryptedAesKeyForSender),
        },
      ],
      timestamp: Date.now(),
    };

    input.value = ""; // Clear input after preparing message

    // Use the generic send function to deliver the message
    await send(contactId, payload, message, "text");
  }

  // Expose functions on the global app object.
  app.websocket.connect = connectWebSocket;
  app.websocket.send = send;
  app.websocket.sendTextMessage = sendTextMessage;
})(app);
