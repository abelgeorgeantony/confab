const Loader = (function () {
  const overlay = document.getElementById("loading-overlay");
  const container = document.querySelector(".loading-container");
  const dotIntervals = {};
  let bubbles = [];
  let currentIndex = -1;

  /** Starts the text-based dot animation for a specific bubble. */
  function startDotAnimation(dotsElement, index) {
    dotsElement.classList.add("show");
    let dotCount = 0;
    const intervalId = setInterval(() => {
      dotCount = (dotCount + 1) % 4; // Cycles from 0 to 3
      dotsElement.textContent = ".".repeat(dotCount);
    }, 350);
    dotIntervals[index] = intervalId;
  }

  /** Stops the dot animation and leaves a static '...' */
  function stopDotAnimation(index) {
    if (dotIntervals[index]) {
      clearInterval(dotIntervals[index]);
      delete dotIntervals[index];
      const dots = bubbles[index]?.querySelector(".loader-dots");
      if (dots) {
        dots.textContent = "...";
      }
    }
  }

  /** Creates a new bubble element and adds it to the DOM. */
  function createBubble() {
    const bubble = document.createElement("div");
    bubble.className = "loading-bubble";

    const textSpan = document.createElement("span");
    textSpan.className = "loader-text";

    const dotsSpan = document.createElement("span");
    dotsSpan.className = "loader-dots";

    bubble.appendChild(textSpan);
    bubble.appendChild(dotsSpan);

    container.appendChild(bubble);
    bubbles.push(bubble);
    return bubble;
  }

  /** Resets the loader to its initial state. */
  function reset() {
    Object.values(dotIntervals).forEach(clearInterval);
    container.innerHTML = ""; // Clear dynamically added bubbles
    bubbles = [];
    currentIndex = -1;
  }

  return {
    /**
     * Starts the loader overlay and shows the first message.
     * @param {string} initialMessage - The first status message to display.
     */
    start: function (initialMessage) {
      reset();
      overlay.classList.remove("hidden");
      this.addMessage(initialMessage);
    },

    /**
     * Adds a new loading message to the sequence.
     * @param {string} newMessage - The new status message to display.
     */
    addMessage: function (newMessage) {
      if (currentIndex >= 0) {
        stopDotAnimation(currentIndex);
      }

      currentIndex++;

      const bubble = createBubble();
      const text = bubble.querySelector(".loader-text");
      const dots = bubble.querySelector(".loader-dots");

      // Assign incoming/outgoing style
      bubble.classList.add(currentIndex % 2 === 0 ? "incoming" : "outgoing");

      text.textContent = newMessage;

      // Use a tiny timeout to allow the element to be in the DOM
      // before adding the 'show' class, ensuring the transition runs.
      setTimeout(() => {
        bubble.classList.add("show");
      }, 10);

      startDotAnimation(dots, currentIndex);
    },

    /**
     * Stops the final animation and gracefully hides the loader.
     */
    stop: function () {
      if (currentIndex >= 0) {
        stopDotAnimation(currentIndex);
      }
      setTimeout(() => {
        overlay.classList.add("hidden");
      }, 500);
    },
  };
})();
