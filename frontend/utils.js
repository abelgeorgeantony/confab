SERVER_IP = window.location.host;
console.log(SERVER_IP);

FRONTEND = "https://" + SERVER_IP + "/frontend/";
API = "https://" + SERVER_IP + "/backend/";
WS_URL = "wss://" + SERVER_IP + "/ws/";

// Get a cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop().split(";").shift();
    return decodeURIComponent(cookieValue);
  }
  return null;
}

// Set a cookie with options
function setCookie(name, value, options = {}) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.maxAge) {
    cookie += `; max-age=${options.maxAge}`;
  }

  if (options.expires) {
    cookie += `; expires=${options.expires.toUTCString()}`;
  }

  if (options.path) {
    cookie += `; path=${options.path}`;
  } else {
    cookie += `; path=/`;
  }

  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }

  if (options.secure) {
    cookie += `; Secure`;
  }

  document.cookie = cookie;
}

// Delete a cookie by name
function deleteCookie(name) {
  setCookie(name, "", { maxAge: 0 });
}

function fixMobileViewport() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

window.addEventListener("resize", fixMobileViewport);
window.addEventListener("load", fixMobileViewport);

fixMobileViewport();

// Mobile viewport height fix for all pages
function fixMobileViewport() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

// Run on load & resize
//window.addEventListener('load', fixMobileViewport);
//window.addEventListener('resize', fixMobileViewport);

// Page theme
function toggleTheme() {
  const body = document.body;
  body.classList.toggle("dark-mode");

  const currentTheme = body.classList.contains("dark-mode") ? "dark" : "light";
  localStorage.setItem("theme", currentTheme);
}

/**
 * Applies the saved theme from localStorage or system preference on page load.
 * It also sets the initial state of the toggle switch.
 */
function applyInitialTheme() {
  const savedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const themeToggleCheckbox = document.getElementById("theme-toggle-checkbox");
  let isDark = false;

  if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
    isDark = true;
  }

  if (isDark) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  if (themeToggleCheckbox) {
    themeToggleCheckbox.checked = isDark;
  }
}

let statusTextTimer = null;
function setConnectionStatus(text, status = "default") {
  const statusContainer = document.getElementById("connection-status");
  if (!statusContainer) return;

  const iconEl = statusContainer.querySelector(".status-icon");
  const textEl = statusContainer.querySelector(".status-text");
  if (!iconEl || !textEl) return;

  // 1. Set the icon and class based on status
  statusContainer.className = `connection-status ${status}`;
  if (status === "connected") {
    iconEl.textContent = "sentiment_very_satisfied"; // Material icon for connected
  } else if (status === "disconnected") {
    iconEl.textContent = "sentiment_very_dissatisfied"; // Material icon for disconnected
    statusContainer.addEventListener("onclick", () => {
      connectWebSocket();
    });
  } else {
    iconEl.textContent = "sync"; // Material icon for connecting/default
  }

  // 2. Set the text and make it visible
  textEl.textContent = text;
  textEl.style.opacity = 1;

  // 3. Clear any previous fade-out timer
  clearTimeout(statusTextTimer);

  // 4. Set a new timer to fade the text out after 4 seconds
  statusTextTimer = setTimeout(() => {
    statusContainer.classList.add("icon-only");
    //textEl.style.opacity = 0;
  }, 2000); // 2 seconds
}

let currentBackAction = null;
let isBackButtonActive = false;
let isProgrammaticBack = false; // Flag to prevent popstate recursion

const handleKeyDownForBack = (event) => {
  if (event.key === "Escape" && isBackButtonActive && currentBackAction) {
    currentBackAction();
  }
};

window.addEventListener("popstate", () => {
  if (isProgrammaticBack) {
    isProgrammaticBack = false; // Reset the flag and do nothing
    return;
  }
  if (isBackButtonActive && currentBackAction) {
    currentBackAction();
  }
});

/* * Shows a back button in the status bar.
 * @param {function} onClickAction - The function to call when the button is clicked.*/
function showStatusBarBackButton(onClickAction) {
  const backBtn = document.getElementById("status-bar-back-btn");
  if (backBtn) {
    // THE FIX: We no longer hide the status element.
    backBtn.style.display = "block";
    backBtn.onclick = onClickAction;

    currentBackAction = onClickAction;
    isBackButtonActive = true;

    document.addEventListener("keydown", handleKeyDownForBack);
    // Only push state if one doesn't already exist
    if (!history.state || !history.state.onBack) {
      history.pushState({ onBack: true }, "");
    }
  }
}

// Hides the back button in the status bar.
function hideStatusBarBackButton() {
  const backBtn = document.getElementById("status-bar-back-btn");
  if (backBtn) {
    backBtn.style.display = "none";
    backBtn.onclick = null;
  }

  document.removeEventListener("keydown", handleKeyDownForBack);
  isBackButtonActive = false;
  currentBackAction = null;

  if (history.state && history.state.onBack) {
    isProgrammaticBack = true;
    history.back();
  }
}

// Run the function to apply the theme as soon as the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  applyInitialTheme();
  //greeter.show();
});

window.addEventListener("load", () => {
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      loadingOverlay.style.display = "none";
    }, 500);
  }
});
