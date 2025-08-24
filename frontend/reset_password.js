document.addEventListener("DOMContentLoaded", () => {
  // Add a listener to the password input to validate as the user types.
  const passwordInput = document.getElementById("new_password");
  if (passwordInput) {
    passwordInput.addEventListener("keyup", validatePassword);
  }
});

/**
 * Handles the final step of the password reset process.
 */
async function handlePasswordReset() {
  const passwordInput = document.getElementById("new_pass");
  const messageArea = document.getElementById("message-area");
  const newPassword = passwordInput.value;

  // 1. Get the reset token from the URL query parameters.
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    messageArea.textContent =
      "Invalid or missing reset token. Please request a new link.";
    messageArea.style.color = "var(--danger-color)";
    return;
  }

  // 2. Use the local validation function.
  if (validatePassword(passwordInput) !== true) {
    messageArea.textContent =
      "Please fix the errors with your password before submitting.";
    messageArea.style.color = "var(--danger-color)";
    return;
  }

  messageArea.textContent = "Updating your password...";
  messageArea.style.color = "var(--text-color-light)";

  try {
    // 1. Generate a new RSA key pair.
    const keyPair = await cryptoHandler.generateRsaKeyPair();
    const publicKeyJwk = await cryptoHandler.exportKeyToJwk(keyPair.publicKey);

    // 2. Generate a random salt for password key derivation.
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // 3. Derive a key from the password and salt to encrypt the private key.
    const passwordDerivedKey = await cryptoHandler.deriveKeyFromPassword(
      newPassword,
      salt,
    );

    // 4. Encrypt the private key.
    const privateKeyJwk = await cryptoHandler.exportKeyToJwk(
      keyPair.privateKey,
    );

    localStorage.setItem(
      "decrypted_private_key",
      JSON.stringify(privateKeyJwk),
    );

    const { ciphertext: encryptedPrivateKeyData, iv: privateKeyIv } =
      await cryptoHandler.aesEncrypt(
        JSON.stringify(privateKeyJwk),
        passwordDerivedKey,
      );

    // 3. Send the token and new password to the backend.
    const res = await fetch(API + "reset_password.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        new_password: newPassword,
        publicKey: JSON.stringify(publicKeyJwk),
        encryptedPrivateKey: cryptoHandler.arrayBufferToBase64(
          encryptedPrivateKeyData,
        ),
        privateKeySalt: cryptoHandler.arrayBufferToBase64(salt),
        privateKeyIv: cryptoHandler.arrayBufferToBase64(privateKeyIv),
      }),
    });

    const data = await res.json();

    // 4. Handle the server's response.
    if (data.success) {
      messageArea.textContent = "Your password has been successfully updated!";
      messageArea.style.color = "var(--status-connected-color)";
      // Hide the form and show the login link.
      document.getElementById("reset-form").style.display = "none";
      document.getElementById("login-link").style.display = "block";

      alert("Password updated successfully! Redirecting to login!");
      window.location.replace("login.html");
    } else {
      messageArea.textContent = `Error: ${data.error || "An unknown error occurred."}`;
      messageArea.style.color = "var(--danger-color)";
    }
  } catch (error) {
    console.error("Password reset failed:", error);
    messageArea.textContent = "A network error occurred. Please try again.";
    messageArea.style.color = "var(--danger-color)";
  }
}
