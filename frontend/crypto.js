/**
 * ==============================================================================
 * | crypto.js - E2EE Cryptographic Utilities (Class-based)
 * ==============================================================================
 * | This file provides a class `E2EECrypto` to handle all cryptographic
 * | operations for the chat application using the browser's Web Crypto API.
 * | The class-based syntax makes it cleaner to use and organize.
 * ------------------------------------------------------------------------------
 */

class E2EECrypto {

    // --- Key Generation ---

    /**
     * Generates a new RSA-OAEP key pair for asymmetric encryption.
     * @returns {Promise<CryptoKeyPair>}
     */
    async generateRsaKeyPair() {
        return window.crypto.subtle.generateKey({
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        }, true, ['encrypt', 'decrypt']);
    }

    /**
     * Generates a new AES-GCM symmetric key for message encryption.
     * @returns {Promise<CryptoKey>}
     */
    async generateAesKey() {
        return window.crypto.subtle.generateKey({
            name: 'AES-GCM',
            length: 256
        }, true, ['encrypt', 'decrypt']);
    }
    
    

    async deriveKeyFromPassword(password, salt) {
        const encoder = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000, // A standard number of iterations
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }


    // --- Key Import/Export ---

    /**
     * Exports a CryptoKey to a JSON Web Key (JWK) object.
     * @param {CryptoKey} key The key to export.
     * @returns {Promise<Object>} The key in JWK format.
     */
    async exportKeyToJwk(key) {
        return window.crypto.subtle.exportKey('jwk', key);
    }

    /**
     * Imports a public key from JWK format.
     * @param {Object} jwk The public key in JWK format.
     * @returns {Promise<CryptoKey>} A CryptoKey object for encryption.
     */
    async importPublicKeyFromJwk(jwk) {
        return window.crypto.subtle.importKey('jwk', jwk, {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        }, true, ['encrypt']);
    }

    /**
     * Imports a private key from JWK format.
     * @param {Object} jwk The private key in JWK format.
     * @returns {Promise<CryptoKey>} A CryptoKey object for decryption.
     */
    async importPrivateKeyFromJwk(jwk) {
        return window.crypto.subtle.importKey('jwk', jwk, {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        }, true, ['decrypt']);
    }

    /**
     * Imports an AES key from JWK format.
     * @param {Object} jwk The AES key in JWK format.
     * @returns {Promise<CryptoKey>} A CryptoKey object for decryption.
     */
    async importAesKeyFromJwk(jwk) {
        return window.crypto.subtle.importKey(
            'jwk',
	    jwk,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // --- Encryption / Decryption ---

    /**
     * Encrypts a message with a symmetric AES key.
     * @param {string} plaintext The message to encrypt.
     * @param {CryptoKey} aesKey The symmetric key.
     * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array}>}
     */
    async aesEncrypt(plaintext, aesKey) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Generate a random IV
        const encodedPlaintext = new TextEncoder().encode(plaintext);
        const ciphertext = await window.crypto.subtle.encrypt({
            name: 'AES-GCM',
            iv: iv
        }, aesKey, encodedPlaintext);
        return { ciphertext, iv };
    }

    /**
     * Decrypts a message with a symmetric AES key.
     * @param {ArrayBuffer} ciphertext The encrypted data.
     * @param {CryptoKey} aesKey The symmetric key.
     * @param {Uint8Array} iv The initialization vector.
     * @returns {Promise<string>} The decrypted plaintext.
     */
    async aesDecrypt(ciphertext, aesKey, iv) {
        const decrypted = await window.crypto.subtle.decrypt({
            name: 'AES-GCM',
            iv: iv
        }, aesKey, ciphertext);
        return new TextDecoder().decode(decrypted);
    }
    
    /**
     * Encrypts data (like an AES key) with an RSA public key.
     * @param {ArrayBuffer} data The data to encrypt.
     * @param {CryptoKey} rsaPublicKey The recipient's public key.
     * @returns {Promise<ArrayBuffer>} The encrypted data.
     */
    async rsaEncrypt(data, rsaPublicKey) {
        return window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, data);
    }

    /**
     * Decrypts data (like an AES key) with an RSA private key.
     * @param {ArrayBuffer} encryptedData The data to decrypt.
     * @param {CryptoKey} rsaPrivateKey The user's private key.
     * @returns {Promise<ArrayBuffer>} The decrypted data.
     */
    async rsaDecrypt(encryptedData, rsaPrivateKey) {
        return window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaPrivateKey, encryptedData);
    }


    // --- Utility Functions ---

    /**
     * Converts an ArrayBuffer to a Base64 string.
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    /**
     * Converts a Base64 string to an ArrayBuffer.
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Create a single, global instance of the crypto class for easy access
const cryptoHandler = new E2EECrypto();

