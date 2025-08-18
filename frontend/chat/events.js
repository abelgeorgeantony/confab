// frontend/chat/events.js
// Centralizes the application's event handling logic.
// It attaches its functions to the 'app.events' namespace.

(function (app) {
  /**
   * A helper function to dispatch custom events.
   * @param {string} name - The name of the event.
   * @param {Object} [detail={}] - The data to pass with the event.
   */
  function triggerEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /**
   * Sets up all the main event listeners for the application.
   */
  function initializeEventListeners() {
    // Listener for incoming messages (both real-time and offline).
    document.addEventListener("messageReceived", async (e) => {
      const { senderId, payload } = e.detail;
      let decryptedMessage;

      try {
        if (!app.state.myPrivateKey) throw new Error("Private key not loaded.");

        // E2EE Decryption Flow
        const encryptedKey = cryptoHandler.base64ToArrayBuffer(
          payload.encryptedKey,
        );
        const iv = cryptoHandler.base64ToArrayBuffer(payload.iv);
        const ciphertext = cryptoHandler.base64ToArrayBuffer(
          payload.ciphertext,
        );
        const decryptedAesKeyData = await cryptoHandler.rsaDecrypt(
          encryptedKey,
          app.state.myPrivateKey,
        );
        const aesKeyJwk = JSON.parse(
          new TextDecoder().decode(decryptedAesKeyData),
        );
        const aesKey = await cryptoHandler.importAesKeyFromJwk(aesKeyJwk);
        decryptedMessage = await cryptoHandler.aesDecrypt(
          ciphertext,
          aesKey,
          iv,
        );
      } catch (error) {
        console.error("Decryption failed:", error);
        decryptedMessage = "🔒 [Could not decrypt message]";
      }

      // Save the message locally.
      app.storage.saveMessageLocally(
        senderId,
        "them",
        decryptedMessage,
        payload.timestamp,
      );
      // If the message is for the currently active chat, display it.
      /*if (Number(app.state.currentChatUser) === Number(senderId)) {
        app.ui.displayMessage("them", decryptedMessage, payload.timestamp);
      } else {
        // Otherwise, increment the unread count.
        app.state.unreadCounts[senderId] =
          (app.state.unreadCounts[senderId] || 0) + 1;
        app.ui.updateUnreadBadge(senderId);
      }*/
    });

    // Listener to rebuild the contact list UI when contacts are loaded/updated.
    document.addEventListener("contactsLoaded", () => {
      const list = document.getElementById("user-list");
      list.innerHTML = "";

      app.state.allContacts.forEach((contact) => {
        if (contact.contact_id !== undefined) {
          contact.id = contact.contact_id;
          delete contact.contact_id;
        }
      });

      const sortedContacts = app.state.allContacts.sort((a, b) => {
        const lastMsgA = app.storage.getLastMessage(a.id);
        const lastMsgB = app.storage.getLastMessage(b.id);
        return (lastMsgB?.timestamp || 0) - (lastMsgA?.timestamp || 0);
      });

      sortedContacts.forEach((contact) => {
        if (contact.public_key) {
          app.state.publicKeyCache[contact.id] = JSON.parse(contact.public_key);
        }
        const contactDiv = document.createElement("div");
        contactDiv.className = "contact-card";
        contactDiv.setAttribute("data-contact-id", contact.id);
        const lastMsg = app.storage.getLastMessage(contact.id);
        const lastMsgText = lastMsg
          ? lastMsg.message.replace(/[\n\r]/g, " ")
          : "Tap to chat";
        contactDiv.innerHTML = `
          <div class="contact-avatar">${contact.username.charAt(0).toUpperCase()}</div>
          <div class="contact-info">
              <div class="contact-name">${contact.display_name}</div>
              <div class="contact-lastmsg">${lastMsgText}</div>
          </div>
        `;
        contactDiv.onclick = () => app.init.openChatWith(contact);
        list.appendChild(contactDiv);
        if (app.state.unreadCounts[contact.id] > 0) {
          app.ui.updateUnreadBadge(contact.id);
        }
      });
    });

    // Listener to update a contact's last message preview.
    document.addEventListener("lastMessageUpdated", (e) => {
      const { contactId, sender, message, timestamp } = e.detail;
      const list = document.getElementById("user-list");
      const card = list.querySelector(`[data-contact-id="${contactId}"]`);

      // **FIX:** If the chat is of a user not in our contact list,
      // fetch their details and add them dynamically.
      if (!card && !app.state.allContacts.some((c) => c.id == contactId)) {
        const token = getCookie("auth_token");
        fetch(API + "add_non_contact.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, contactId: contactId }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.contact) {
              app.state.allContacts.push(data.contact);
              triggerEvent("contactsLoaded"); // This will re-render the entire list correctly.
            }
          });
      } else if (card) {
        card.querySelector(".contact-lastmsg").textContent = message.replace(
          /[\n\r]/g,
          " ",
        );
        // Move the card to the top of the list for recent activity.
        if (list.firstChild !== card) {
          list.prepend(card);
        }
      }
      if (Number(app.state.currentChatUser) === Number(contactId)) {
        app.ui.displayMessage(sender, decryptedMessage, payload.timestamp);
      } else {
        // Otherwise, increment the unread count.
        app.state.unreadCounts[contactId] =
          (app.state.unreadCounts[contactId] || 0) + 1;
        app.ui.updateUnreadBadge(contactId);
      }
    });
  }

  // Expose functions on the global app object.
  app.events.trigger = triggerEvent;
  app.events.initialize = initializeEventListeners;
})(app);
