let registrationState = {
  email: "",
  token: "",
};

// --- Page Load Logic ---
// This runs when the page is loaded to show the correct step.
document.addEventListener("DOMContentLoaded", () => {
  const passInput = document.querySelector(".password-input");
  if (passInput) {
    passInput.addEventListener("focus", () => {
      const elementStyle = window.getComputedStyle(passInput);
      document.querySelector(".password-eye").style.outline =
        elementStyle.outline;
    });
    passInput.addEventListener("blur", (event) => {
      if (event.relatedTarget == document.querySelector(".password-eye")) {
        setTimeout(() => {
          passInput.focus();
        }, 10);
      }
      document.querySelector(".password-eye").style.outline = "";
    });
  }

  const registrationForm = document.getElementById("step1");

  if (registrationForm) {
    initializeRegistrationFlow();
    const usernameInput = document.getElementById("reg_username");
    usernameInput.addEventListener("keyup", checkUsernameAvailability);
    const useremailInput = document.getElementById("reg_email");
    useremailInput.addEventListener("keyup", validateEmail);
    const userpassInput = document.getElementById("reg_pass");
    userpassInput.addEventListener("keyup", validatePassword);

    // for page 2
    const codeInputsContainer = document.getElementById("code-inputs");
    if (codeInputsContainer) {
      const inputs = codeInputsContainer.querySelectorAll(".code-input");
      const hiddenInput = document.getElementById("verification_code");

      inputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
          // Move to next input if a digit is entered
          if (e.target.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
          updateHiddenInput();
        });

        input.addEventListener("keydown", (e) => {
          // Move to previous input on backspace if current is empty
          if (
            e.key === "Backspace" &&
            e.target.value.length === 0 &&
            index > 0
          ) {
            inputs[index - 1].focus();
          }
        });

        input.addEventListener("paste", (e) => {
          e.preventDefault();
          const pasteData = e.clipboardData.getData("text").trim();
          if (pasteData.length === 6 && /^\d{6}$/.test(pasteData)) {
            inputs.forEach((box, i) => {
              box.value = pasteData[i];
            });
            inputs[inputs.length - 1].focus();
            updateHiddenInput();
          }
        });
      });

      function updateHiddenInput() {
        let combinedCode = "";
        inputs.forEach((input) => {
          combinedCode += input.value;
        });
        hiddenInput.value = combinedCode;
      }
    }

    // Attach event listener for profile picture preview if on the right page
    const pfpInput = document.getElementById("pfp_input");
    if (pfpInput) {
      pfpInput.onchange = (event) => {
        const [file] = event.target.files;
        if (file) {
          document.getElementById("pfp-preview").src =
            URL.createObjectURL(file);
        }
      };
    }
  }
});

function initializeRegistrationFlow() {
  const step = getCookie("registration_step");
  if (step === "3") {
    // If they are on step 3, we need their auth token to proceed
    const authToken = getCookie("auth_token");
    if (authToken) {
      registrationState.token = authToken;
      showStep(3);
    } else {
      // If token is missing, they must start over.
      deleteCookie("registration_step");
      showStep(1);
    }
  } else if (step === "2") {
    // We also need the email they used to get here
    const regEmail = getCookie("registration_email");
    if (regEmail) {
      registrationState.email = regEmail;
      document.getElementById("verification-email-display").textContent =
        regEmail;
      showStep(2);
    } else {
      // If email is missing, start over
      deleteCookie("registration_step");
      showStep(1);
    }
  } else {
    // Default to step 1
    showStep(1);
  }
}

async function checkUsernameAvailability() {
  const username = document.getElementById("reg_username").value;
  const feedbackEl = document.getElementById("username-feedback");
  if (username.length < 3) {
    feedbackEl.textContent = "";
    return;
  }

  const res = await fetch(API + "check_username.php", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const data = await res.json();

  if (data.available) {
    feedbackEl.textContent = "Username is available!";
    feedbackEl.classList.add("good");
  } else {
    feedbackEl.textContent = "Username is taken.";
    feedbackEl.classList.add("bad");
  }
}

function validateEmail() {
  const email = document.getElementById("reg_email").value;
  const feedbackEl = document.getElementById("email-feedback");

  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = pattern.test(email);
  if (!valid) {
    feedbackEl.textContent = "Enter a valid email";
    feedbackEl.classList.add("bad");
  } else {
    feedbackEl.textContent = "";
    feedbackEl.classList.remove("bad");
  }
}

function validatePassword() {
  const password = document.getElementById("reg_pass").value;
  const feedbackEl = document.getElementById("password-feedback");

  let pattern = /^.{8,15}$/;
  if (!pattern.test(password)) {
    feedbackEl.textContent = "Password too short or long! (>= 8 and <= 15)";
    feedbackEl.classList.add("bad");
    return;
  }
  pattern = /[A-Z]/;
  if (!pattern.test(password)) {
    feedbackEl.textContent = "Include Atleast 1 Uppercase letter!";
    feedbackEl.classList.add("bad");
    return;
  }
  pattern = /[a-z]/;
  if (!pattern.test(password)) {
    feedbackEl.textContent = "Include Atleast 1 Lowercase letter!";
    feedbackEl.classList.add("bad");
    return;
  }
  pattern = /\d/;
  if (!pattern.test(password)) {
    feedbackEl.textContent = "Include Atleast 1 number!";
    feedbackEl.classList.add("bad");
    return;
  }
  pattern = /[^a-zA-Z0-9@_]/g;
  const disallowed = password.match(pattern);
  if (disallowed) {
    feedbackEl.textContent = "Disallowed characters: " + disallowed;
    feedbackEl.classList.add("bad");
    return;
  }

  feedbackEl.textContent = "";
  feedbackEl.classList.remove("bad");
}

// --- Main Registration Functions ---

async function handleStep1(event) {
  event.preventDefault();
  const messageArea = document.getElementById("message-area");
  messageArea.textContent = "Creating account...";

  registrationState.email = document.getElementById("reg_email").value;

  // 1. Generate a new RSA key pair.
  const keyPair = await cryptoHandler.generateRsaKeyPair();
  const publicKeyJwk = await cryptoHandler.exportKeyToJwk(keyPair.publicKey);

  // 2. Generate a random salt for password key derivation.
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  // 3. Derive a key from the password and salt to encrypt the private key.
  const passwordDerivedKey = await cryptoHandler.deriveKeyFromPassword(
    document.getElementById("reg_pass").value,
    salt,
  );

  // 4. Encrypt the private key.
  const privateKeyJwk = await cryptoHandler.exportKeyToJwk(keyPair.privateKey);

  localStorage.setItem("decrypted_private_key", JSON.stringify(privateKeyJwk));

  const { ciphertext: encryptedPrivateKeyData, iv: privateKeyIv } =
    await cryptoHandler.aesEncrypt(
      JSON.stringify(privateKeyJwk),
      passwordDerivedKey,
    );

  const payload = {
    username: document.getElementById("reg_username").value,
    email: registrationState.email,
    password: document.getElementById("reg_pass").value,
    publicKey: JSON.stringify(publicKeyJwk),
    encryptedPrivateKey: cryptoHandler.arrayBufferToBase64(
      encryptedPrivateKeyData,
    ),
    privateKeySalt: cryptoHandler.arrayBufferToBase64(salt),
    privateKeyIv: cryptoHandler.arrayBufferToBase64(privateKeyIv),
  };

  // This now points to your original register.php script
  const res = await fetch(API + "register.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.success) {
    messageArea.textContent = "";

    // Set cookies to remember state for step 2
    setCookie("registration_step", "2", { maxAge: 900 }); // 15-minute expiry
    setCookie("registration_email", registrationState.email, { maxAge: 900 });

    document.getElementById("verification-email-display").textContent =
      registrationState.email;
    showStep(2);
  } else {
    messageArea.textContent = "Error: " + data.error;
  }
}

async function handleStep2(event) {
  event.preventDefault();
  const messageArea = document.getElementById("message-area");
  messageArea.textContent = "Verifying code...";

  const payload = {
    email: registrationState.email,
    code: document.getElementById("verification_code").value,
    purpose: "registration", // Registration verification
  };

  const res = await fetch(API + "verify_email.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (data.success) {
    messageArea.textContent = "";
    registrationState.token = data.token; // Save the session token

    // Set auth token and update registration step
    setCookie("auth_token", registrationState.token, { maxAge: 86400 });
    setCookie("registration_step", "3", { maxAge: 900 });
    deleteCookie("registration_email"); // No longer needed
    showStep(3);
  } else {
    messageArea.textContent = "Error: " + data.error;
  }
}

async function handleStep3(event) {
  event.preventDefault();
  const messageArea = document.getElementById("message-area");
  messageArea.textContent = "Saving profile...";

  const formData = new FormData();
  formData.append("token", registrationState.token);
  formData.append("display_name", document.getElementById("reg_name").value);
  formData.append("bio", document.getElementById("reg_bio").value);

  const pfpInput = document.getElementById("pfp_input");
  if (pfpInput.files.length > 0) {
    formData.append("profile_picture", pfpInput.files[0]);
  }

  // Use the existing update_profile.php endpoint
  const res = await fetch(API + "update_profile.php", {
    method: "POST",
    body: formData, // No Content-Type header needed, browser sets it for FormData
  });
  const data = await res.json();

  if (data.success) {
    // Clean up registration cookies on success
    deleteCookie("registration_step");
    deleteCookie("registration_email"); // Just in case

    window.location.replace("chat.html");
  } else {
    messageArea.textContent = "Error: " + data.error;
  }
}

// --- Helper Functions ---

function showStep(stepNumber) {
  document
    .querySelectorAll(".step")
    .forEach((step) => step.classList.remove("active"));
  document.getElementById(`step${stepNumber}`).classList.add("active");
}

// Attach event listener for profile picture preview
document.addEventListener("DOMContentLoaded", () => {
  const pfpInput = document.getElementById("pfp_input");
  if (pfpInput) {
    pfpInput.onchange = (event) => {
      const [file] = event.target.files;
      if (file) {
        document.getElementById("pfp-preview").src = URL.createObjectURL(file);
      }
    };
  }
});

async function login() {
  const uname = document.getElementById("login_username").value;
  const pass = document.getElementById("login_pass").value;
  const s_dur = parseInt(document.getElementById("session_length").value);

  const res = await fetch(API + "login.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: uname,
      password: pass,
      s_duration: s_dur,
    }),
  });

  const data = await res.json();

  if (data.success) {
    const salt = cryptoHandler.base64ToArrayBuffer(data.private_key_salt);
    const iv = cryptoHandler.base64ToArrayBuffer(data.private_key_iv);
    const encryptedKeyData = cryptoHandler.base64ToArrayBuffer(
      data.encrypted_private_key,
    );
    const passwordDerivedKey = await cryptoHandler.deriveKeyFromPassword(
      pass,
      salt,
    );

    const decryptedPrivateKeyJwkString = await cryptoHandler.aesDecrypt(
      encryptedKeyData,
      passwordDerivedKey,
      iv,
    );

    localStorage.setItem("decrypted_private_key", decryptedPrivateKeyJwkString);
    setCookie("auth_token", data.token, {
      maxAge: s_dur,
      sameSite: "Strict",
      secure: location.protocol === "https:",
    });
    window.location.replace("chat.html");
  } else {
    if (data.error === "not_verified") {
      alert(
        "Your account is not verified. We'll take you to the verification page. We have sent a new code to " +
          data.email,
      );
      // Set cookies to resume the registration flow at step 2
      setCookie("registration_step", "2", { maxAge: 900 });
      setCookie("registration_email", data.email, { maxAge: 900 });
      // Redirect to the registration page
      window.location.replace("register.html");
    } else {
      alert(data.error);
    }
  }
}

async function resendVerificationCode(event) {
  event.preventDefault(); // Prevent the link from navigating
  const resendLink = document.getElementById("resend-link");
  const originalText = resendLink.textContent;

  // Get the email from our state (which is set when the page loads)
  const email = registrationState.email;
  if (!email) {
    alert(
      "Could not find an email to resend the code to. Please try logging in again.",
    );
    return;
  }

  // Disable the link to prevent spamming
  resendLink.style.pointerEvents = "none";
  resendLink.style.color = "#999";

  let countdown = 60;
  resendLink.textContent = `Resend in ${countdown}s`;
  const interval = setInterval(() => {
    countdown--;
    resendLink.textContent = `Resend in ${countdown}s`;
    if (countdown <= 0) {
      clearInterval(interval);
      resendLink.textContent = originalText;
      resendLink.style.pointerEvents = "auto";
      resendLink.style.color = "";
    }
  }, 1000);

  // Make the API call
  const res = await fetch(API + "resend_code.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email }),
  });

  const data = await res.json();
  if (data.success) {
    alert(data.message);
  } else {
    alert("Error: " + data.error);
  }
}

// For seemless authentication on pages like login.html, register.html and index.html
async function redirectIfAuthenticated() {
  const token = getCookie("auth_token");
  if (!token) return;

  try {
    const res = await fetch(API + "validate_token.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (data.valid) {
      window.location.replace(FRONTEND + "chat.html");
    }
  } catch (err) {
    console.error("Auth check failed", err);
  }
}
// For gaining auth confirmation for protected tasks on pages like chat.html
async function requireAuth() {
  return new Promise(async (resolve, reject) => {
    const token = getCookie("auth_token");
    if (!token) {
      window.location.replace("login.html");
      return reject(new Error("No auth token!"));
    }
    const privateKeyJwkString = localStorage.getItem("decrypted_private_key");
    if (!privateKeyJwkString) {
      deleteCookie("auth_token");
      localStorage.clear();
      window.location.replace("login.html");
      return reject(new Error("No private key!"));
    }

    try {
      const res = await fetch(API + "validate_token.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!data.valid) {
        window.location.replace("login.html");
        reject(new Error("Invalid auth token!"));
      } else {
        resolve();
      }
    } catch (err) {
      console.error("Token validation failed:", err);
      window.location.replace("login.html");
      reject(err);
    }
  });
}

function togglePassVisibility(eyebutton) {
  const passwordInput = eyebutton.parentElement.firstElementChild;

  const type =
    passwordInput.getAttribute("type") === "password" ? "text" : "password";
  if (type === "password") {
    eyebutton.textContent = "visibility";
  } else {
    eyebutton.textContent = "visibility_off";
  }
  passwordInput.setAttribute("type", type);
}
