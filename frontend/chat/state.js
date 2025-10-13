// frontend/chat/state.js
// This script must be the first one loaded.
// It initializes a single global object 'app' to hold all modules and state.

var app = {
  // Holds the application's dynamic data.
  state: {
    ws: null,
    unreadCounts: {},
    currentChatUser: null,
    allContacts: [],
    myPrivateKey: null,
    myPublicKey: null,
    publicKeyCache: {},
  },
  // Namespace for utility functions (e.g., local storage).
  storage: {},
  // Namespace for UI manipulation functions.
  ui: {},
  // Namespace for backend API calls.
  api: {},
  // Namespace for WebSocket handling.
  websocket: {},
  // Namespace for custom event management.
  events: {},
  // Namespace for initialization and main functions.
  init: {},
};
