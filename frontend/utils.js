SERVER_IP = "192.168.1.7";

FRONTEND = "http://" + SERVER_IP + ":8000/frontend/";
API = "http://" + SERVER_IP + ":8000/backend/";
WS_URL = "ws://" + SERVER_IP + ":8080";

// Get a cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop().split(';').shift();
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
  setCookie(name, '', { maxAge: 0 });
}


// Mobile viewport height fix for all pages
function fixMobileViewport() {
  let vh = window.innerHeight * 0.01; 
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Run on load & resize
//window.addEventListener('load', fixMobileViewport);
//window.addEventListener('resize', fixMobileViewport);


// Page theme
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    
    const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
}

/**
 * Applies the saved theme from localStorage or system preference on page load.
 * It also sets the initial state of the toggle switch.
 */
function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
    let isDark = false;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        isDark = true;
    }

    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    if (themeToggleCheckbox) {
        themeToggleCheckbox.checked = isDark;
    }
}


/* * Shows a back button in the status bar.
   * @param {function} onClickAction - The function to call when the button is clicked.*/
function showStatusBarBackButton(onClickAction) {
    const backBtn = document.getElementById('status-bar-back-btn');
    if (backBtn) {
        // THE FIX: We no longer hide the status element.
        backBtn.style.display = 'block';
        backBtn.onclick = onClickAction;
    }
}

// Hides the back button in the status bar.
function hideStatusBarBackButton() {
    const backBtn = document.getElementById('status-bar-back-btn');
    if (backBtn) {
        // THE FIX: We only hide the back button.
        backBtn.style.display = 'none';
    }
}

// Run the function to apply the theme as soon as the DOM is ready
document.addEventListener('DOMContentLoaded', applyInitialTheme);
