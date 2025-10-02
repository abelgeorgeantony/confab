/**
 * Handles the initial request to reset a user's password.
 * It first checks if the username exists before sending the reset link request.
 */
async function handlePasswordResetRequest() {
  const usernameInput = document.getElementById("username");
  const messageArea = document.getElementById("message-area");
  const username = usernameInput.value.trim();

  // 1. Basic validation
  if (!username) {
    messageArea.textContent = "Please enter your username.";
    messageArea.style.color = "var(--danger-color)";
    return;
  }

  // 2. Provide user feedback
  messageArea.textContent = "Checking...";
  messageArea.style.color = "var(--text-color-light)";

  try {
    // 3. Check if the username exists using the existing endpoint
    const namecheck = await fetch(API + "check_username.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username }),
    });
    const name = await namecheck.json();

    // The endpoint returns `available: true` if the username does NOT exist.
    // We only proceed if `available: false`, meaning the user exists.
    if (name.exists) {
      messageArea.textContent =
        "A password reset link has been sent to the associated email address.";
      messageArea.style.color = "var(--status-connected-color)";
      usernameInput.disabled = true; // Disable input after success
      document.getElementById("send-reset-link-btn").disabled = true; // Disable buttons
      // 4. If user exists, send the request to the password reset endpoint
      await fetch(API + "forgot_password.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username }),
      });
      // Note: We don't need to check the response of forgot_password.php
      // because it's designed to always return success.
    } else {
      messageArea.textContent = "User doesn't exist!";
      messageArea.style.color = "var(--danger-color)";
    }
  } catch (error) {
    console.error("Password reset request failed:", error);
    messageArea.textContent =
      "A network error occurred. Please check your connection and try again.";
    messageArea.style.color = "var(--danger-color)";
  }
}
