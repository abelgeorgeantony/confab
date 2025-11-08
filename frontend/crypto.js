(function (app) {
  /**
   * ==============================================================================
   * | crypto.js - E2EE Cryptographic Utilities (Class-based)
   * ==============================================================================
   * | This file provides a class `E2EECrypto` to handle all cryptographic
   * | operations for the chat application using the browser's Web Crypto API.
   * | The class-based syntax makes it cleaner to use and organize.
   * ------------------------------------------------------------------------------
   */

  if (!window.crypto || !window.crypto.subtle) {
    const errorMessage =
      "Web Crypto API is not available. This application requires a secure context (HTTPS or localhost) to function.";
    alert(errorMessage);
    throw new Error(errorMessage);
  }

  class E2EECrypto {
    // ... (all the methods from the class go here)
    // --- Key Generation ---

    /**
     * Generates a new RSA-OAEP key pair for asymmetric encryption.
     * @returns {Promise<CryptoKeyPair>}
     */
    async generateRsaKeyPair() {
      return window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );
    }

    /**
     * Generates a new AES-GCM symmetric key for message encryption.
     * @returns {Promise<CryptoKey>}
     */
    async generateAesKey() {
      return window.crypto.subtle.generateKey(
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        ["encrypt", "decrypt"],
      );
    }

    async deriveKeyFromPassword(password, salt) {
      const encoder = new TextEncoder();
      const baseKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
      );
      return window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    }

    // --- Key Import/Export ---

    async exportKeyToJwk(key) {
      return window.crypto.subtle.exportKey("jwk", key);
    }

    async importPublicKeyFromJwk(jwk) {
      return window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"],
      );
    }

    async importPrivateKeyFromJwk(jwk) {
      return window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"],
      );
    }

    async importAesKeyFromJwk(jwk) {
      return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );
    }

    // --- Encryption / Decryption ---

    async aesEncrypt(data, aesKey) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      let dataToEncrypt;
      if (typeof data === "string") {
        dataToEncrypt = new TextEncoder().encode(data);
      } else if (data instanceof ArrayBuffer) {
        dataToEncrypt = data;
      } else {
        throw new Error("Data must be a string or an ArrayBuffer.");
      }
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        dataToEncrypt,
      );
      return { ciphertext, iv };
    }

    async aesDecrypt(ciphertext, aesKey, iv, asString = true) {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        aesKey,
        ciphertext,
      );

      if (asString) {
        return new TextDecoder().decode(decrypted);
      } else {
        return decrypted; // Return the raw ArrayBuffer
      }
    }

    async rsaEncrypt(data, rsaPublicKey) {
      return window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        rsaPublicKey,
        data,
      );
    }

    async rsaDecrypt(encryptedData, rsaPrivateKey) {
      return await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        rsaPrivateKey,
        encryptedData,
      );
    }

    /**
     * Handles the full decryption flow for a voice message payload.
     * @param {object} payload - The voice message pointer payload {url, key, iv}.
     * @param {CryptoKey} privateKey - The user's private RSA key.
     * @returns {Promise<ArrayBuffer>} A promise that resolves to the decrypted WAV data.
     */
    async decryptVoicePayload(payload, privateKey) {
      // 1. Decrypt AES key
      const myKeyData = payload.keys.find(
        (k) => Number(k.userId) === Number(app.state.myUserId),
      );
      //return;
      const encryptedKey = this.base64ToArrayBuffer(myKeyData.key);

      const decryptedAesKeyData = await this.rsaDecrypt(
        encryptedKey,
        privateKey,
      );

      const aesKeyJwk = JSON.parse(
        new TextDecoder().decode(decryptedAesKeyData),
      );

      const aesKey = await this.importAesKeyFromJwk(aesKeyJwk);

      // 2. Fetch encrypted audio data
      var response;
      if (payload.url) {
        response = await fetch(payload.url);
        if (!response.ok)
          throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      } else {
        response = payload.encryptedBlob;
      }

      const encryptedAudioBuffer = await response.arrayBuffer();

      // 3. Decrypt audio data

      const iv = this.base64ToArrayBuffer(payload.iv);

      const decryptedWavBuffer = await this.aesDecrypt(
        encryptedAudioBuffer,

        aesKey,

        iv,

        false, // Return raw ArrayBuffer
      );

      return decryptedWavBuffer;
    }

    // --- Utility Functions ---

    arrayBufferToBase64(buffer) {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    base64ToArrayBuffer(base64) {
      const binary_string = window.atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    }

    audioBufferToWav(audioBuffer) {
      const numOfChan = audioBuffer.numberOfChannels;
      const length = audioBuffer.length * numOfChan * 2 + 44;
      const buffer = new ArrayBuffer(length);
      const view = new DataView(buffer);
      const channels = [];
      let i, sample;
      let offset = 0;
      let pos = 0;
      const writeString = (s) => {
        for (i = 0; i < s.length; i++) {
          view.setUint8(pos++, s.charCodeAt(i));
        }
      };
      writeString("RIFF");
      view.setUint32(pos, length - 8, true);
      pos += 4;
      writeString("WAVE");
      writeString("fmt ");
      view.setUint32(pos, 16, true);
      pos += 4;
      view.setUint16(pos, 1, true);
      pos += 2;
      view.setUint16(pos, numOfChan, true);
      pos += 2;
      view.setUint32(pos, audioBuffer.sampleRate, true);
      pos += 4;
      view.setUint32(pos, audioBuffer.sampleRate * 2 * numOfChan, true);
      pos += 4;
      view.setUint16(pos, numOfChan * 2, true);
      pos += 2;
      view.setUint16(pos, 16, true);
      pos += 2;
      writeString("data");
      view.setUint32(pos, length - pos - 4, true);
      pos += 4;
      for (i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
      }
      while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
          view.setInt16(pos, sample, true);
          pos += 2;
        }
        offset++;
      }
      return new Blob([view], { type: "audio/wav" });
    }
  }

  function generateClientMessageId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  // Create a single instance and attach it to the app namespace
  app.crypto = new E2EECrypto();
  app.crypto.generateClientMessageId = generateClientMessageId;
})((window.app = window.app || {}));
