// frontend/chat/events.js
// Centralizes the application's event handling logic.
// It attaches its functions to the 'app.events' namespace.

(function (app) {
  // --- Voice Message Variables ---
  let mediaRecorder = null;
  let audioChunks = [];
  let originalAudioBlob = null; // Store the initial raw audio blob (webm)
  let originalAudioBuffer = null; // Store the decoded raw audio buffer
  let currentPlaybackAudioUrl = null; // URL for the currently loaded audio in wavesurfer
  let timerInterval = null;
  let seconds = 0;
  let totalDurationFormatted = "0:00";
  let wavesurfer = null;
  let currentActiveFilter = "none"; // To keep track of the selected filter
  let lowpassFilter = null; // These can remain for potential future real-time effects or initial setup
  let highpassFilter = null;
  let audioContext = null; // Global AudioContext for real-time effects (if any, like simple pitch shift)
  let sourceNode = null; // Connected to wavesurfer's media element for real-time processing
  let isAudioGraphInitialized = false; // Flag to ensure AudioContext setup once

  // --- UI Elements ---
  const messagesContainer = document.getElementById("messages");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const recordButton = document.getElementById("record-button");
  const messageInput = document.getElementById("message-input");
  const voiceUiWrapper = document.getElementById("voice-ui-wrapper");
  const audioFiltersContainer = document.getElementById(
    "audio-filters-container",
  );
  const waveformContainer = document.getElementById("waveform-container");
  const voiceMessageContainer = document.getElementById(
    "voice-message-container",
  );
  const recordingState = document.getElementById("voice-recording-state");
  const playbackState = document.getElementById("voice-playback-state");
  const recordingTimer = document.getElementById("recording-timer");
  const pauseResumeBtn = document.getElementById("pause-resume-recording-btn");
  const stopRecordingBtn = document.getElementById("stop-recording-btn");
  const cancelRecordingBtn = document.getElementById("cancel-recording-btn");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const playbackTimer = document.getElementById("playback-timer");
  const deleteRecordingBtn = document.getElementById("delete-recording-btn");
  const sendVoiceMessageBtn = document.getElementById("send-voice-message-btn");
  const visualizer = document.querySelector(".visualizer");

  /**
   * A helper function to dispatch custom events.
   * @param {string} name - The name of the event.
   * @param {Object} [detail={}] - The data to pass with the event..
   */
  function triggerEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /*function applyFilter(filterType) {
    if (!isAudioGraphInitialized) return;

    // Reset pitch and playback rate
    wavesurfer.getMediaElement().preservesPitch = true;
    wavesurfer.setPlaybackRate(1);

    // Disconnect all nodes from the source
    sourceNode.disconnect();

    if (filterType === "lowpass") {
      if (!lowpassFilter) {
        lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = "lowpass";
        lowpassFilter.frequency.value = 1000;
      }
      sourceNode.connect(lowpassFilter);
      lowpassFilter.connect(audioContext.destination);
    } else if (filterType === "highpass") {
      if (!highpassFilter) {
        highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = "highpass";
        highpassFilter.frequency.value = 800;
      }
      sourceNode.connect(highpassFilter);
      highpassFilter.connect(audioContext.destination);
    } else if (filterType === "talkingtom") {
      wavesurfer.getMediaElement().preservesPitch = false;
      wavesurfer.setPlaybackRate(1.8);
      sourceNode.connect(audioContext.destination);
    } else {
      // 'none'
      sourceNode.connect(audioContext.destination);
    }
  }*/
  async function applyFilter(filterType) {
    currentActiveFilter = filterType; // Update the globally active filter

    // Update UI for active filter button
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .querySelector(`.filter-btn[data-filter="${filterType}"]`)
      .classList.add("active");

    if (originalAudioBuffer) {
      // If there's an active recording, re-process and load the filtered audio for playback
      await loadFilteredAudioForPlayback(currentActiveFilter);
    } else {
      // If no recording is active, we just update the visual selection of the filter button.
      // No audio to apply filter to yet.
      console.log(`Filter selected: ${filterType}, but no audio recorded yet.`);
    }
    // Note: For complex offline filters like 'ghost' and 'optimusprime',
    // real-time AudioNode manipulation is not performed here.
    // The effect is applied by re-rendering the entire buffer via loadFilteredAudioForPlayback.
  }

  function updateWaveformColors() {
    if (wavesurfer) {
      const computedStyle = getComputedStyle(document.body);
      const waveColor = computedStyle.getPropertyValue("--border-color");
      const progressColor = computedStyle.getPropertyValue("--primary-color");
      wavesurfer.setOptions({
        waveColor: waveColor.trim(),
        progressColor: progressColor.trim(),
      });
    }
  }

  // --- UI State Management ---
  function showRecordingUI() {
    document.getElementById("message-input").classList.add("hidden");
    document.getElementById("emoji-button").classList.add("hidden");
    recordButton.classList.add("hidden");
    voiceUiWrapper.classList.remove("hidden");
    recordingState.classList.remove("hidden");
    playbackState.classList.add("hidden");
  }

  function showPlaybackUI() {
    recordingState.classList.add("hidden");
    playbackState.classList.remove("hidden");
    audioFiltersContainer.classList.remove("hidden");
    waveformContainer.classList.remove("hidden");
    messagesContainer.classList.add("voice-ui-active");

    // Set "None" filter as active by default
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    document
      .querySelector('.filter-btn[data-filter="none"]')
      .classList.add("active");
    applyFilter("none");

    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Matches the CSS transition duration
  }

  function showInitialUI() {
    voiceUiWrapper.classList.add("hidden");
    document.getElementById("voice-loading").classList.add("hidden");
    messageInput.classList.remove("hidden");
    document.getElementById("emoji-button").classList.remove("hidden");
    recordButton.classList.remove("hidden");
    resetRecordingState();
    messagesContainer.classList.remove("voice-ui-active");
  }

  /*function resetRecordingState() {
    if (
      mediaRecorder &&
      (mediaRecorder.state === "recording" || mediaRecorder.state === "paused")
    ) {
      mediaRecorder.stop();
    }
    if (wavesurfer) {
      wavesurfer.destroy();
      wavesurfer = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      isAudioGraphInitialized = false;
    }
    clearInterval(timerInterval);
    seconds = 0;
    audioChunks = [];
    audioBlob = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    recordingTimer.textContent = "0:00";
    totalDurationFormatted = "0:00";
    playbackTimer.textContent = "0:00 / 0:00";
    playPauseBtn.textContent = "play_arrow";
  }*/
  function resetRecordingState() {
    // Stop recording if active
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    // Stop all tracks to release microphone if stream is still active
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }

    if (wavesurfer) {
      wavesurfer.destroy(); // Clean up wavesurfer instance
      wavesurfer = null;
    }

    if (timerInterval) {
      clearInterval(timerInterval);
    }
    seconds = 0;
    audioChunks = [];
    originalAudioBlob = null; // Clear original audio blob
    originalAudioBuffer = null; // Clear original audio buffer
    if (currentPlaybackAudioUrl) {
      URL.revokeObjectURL(currentPlaybackAudioUrl); // Clean up the URL
      currentPlaybackAudioUrl = null;
    }
    totalDurationFormatted = "0:00";
    recordingTimer.textContent = "0:00";
    playbackTimer.textContent = "0:00 / 0:00";
    playPauseBtn.textContent = "play_arrow"; // Reset play button icon
    currentActiveFilter = "none"; // Reset active filter to none

    // Reset AudioContext related variables (if they exist)
    if (audioContext) {
      // If `sourceNode` is connected, disconnect it.
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }
      // The audioContext itself can often be reused, but ensure its state is clean.
      // For simplicity, we'll let `loadFilteredAudioForPlayback` handle its initialization
      // or reconnection when needed, ensuring `isAudioGraphInitialized` is reset.
      isAudioGraphInitialized = false;
    }

    // Clear filter nodes if they exist
    lowpassFilter = null;
    highpassFilter = null;
    // Also ensure any filter specific UI is reset if present.
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .querySelector('.filter-btn[data-filter="none"]')
      .classList.add("active");
  }

  // --- Recording Logic ---
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      showRecordingUI();
      waveformContainer.classList.add("hidden");
      audioFiltersContainer.classList.add("hidden");
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();

      // Start timer
      recordingTimer.textContent = "0:00";
      timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        recordingTimer.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
      }, 1000);

      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });

      /*mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        audioUrl = URL.createObjectURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop()); // Release microphone

        if (!wavesurfer) {
          wavesurfer = WaveSurfer.create({
            container: waveformContainer,
            height: "auto",
            barWidth: 2,
            barGap: 1,
            dragToSeek: true,
            plugins: [WaveSurfer.Regions.create({})],
          });
          updateWaveformColors();

          wavesurfer.on("decode", () => {
            const duration = wavesurfer.getDuration();
            const totalMinutes = Math.floor(duration / 60);
            const totalSeconds = Math.floor(duration % 60);
            totalDurationFormatted = `${totalMinutes}:${totalSeconds.toString().padStart(2, "0")}`;
            updatePlaybackTimer();

            if (!isAudioGraphInitialized) {
              audioContext = new (window.AudioContext ||
                window.webkitAudioContext)();
              sourceNode = audioContext.createMediaElementSource(
                wavesurfer.getMediaElement(),
              );
              sourceNode.connect(audioContext.destination);
              isAudioGraphInitialized = true;
            }
          });

          wavesurfer.on("timeupdate", () => {
            updatePlaybackTimer();
          });

          wavesurfer.on("finish", () => {
            playPauseBtn.textContent = "play_arrow";
            wavesurfer.seekTo(0);
            updatePlaybackTimer();
          });
        }
        wavesurfer.load(audioUrl);
      };*/
      mediaRecorder.onstop = async () => {
        // Make onstop async
        originalAudioBlob = new Blob(audioChunks, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop()); // Release microphone

        // Decode the original audio once into an AudioBuffer
        const tempAudioContext = new AudioContext();
        const arrayBuffer = await originalAudioBlob.arrayBuffer();
        originalAudioBuffer =
          await tempAudioContext.decodeAudioData(arrayBuffer);

        // Load the audio into Wavesurfer with the current (default "none") filter
        // The wavesurfer initialization logic is now mostly handled within loadFilteredAudioForPlayback
        await loadFilteredAudioForPlayback(currentActiveFilter);

        showPlaybackUI(); // Now show playback UI after audio is loaded
      };
    } catch (err) {
      console.error("Could not start recording:", err);
      alert(
        "Could not access microphone. Please ensure you have given permission.",
      );
      showInitialUI();
    }
  }

  function togglePauseResume() {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      clearInterval(timerInterval);
      visualizer.classList.add("paused");
      pauseResumeBtn.textContent = "mic";
      pauseResumeBtn.classList.add("resume-mode");
    } else if (mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      visualizer.classList.remove("paused");
      pauseResumeBtn.textContent = "pause";
      pauseResumeBtn.classList.remove("resume-mode");
      timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        recordingTimer.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
      }, 1000);
    }
  }

  function stopRecording() {
    if (
      mediaRecorder &&
      (mediaRecorder.state === "recording" || mediaRecorder.state === "paused")
    ) {
      mediaRecorder.stop();
    }
    clearInterval(timerInterval);
    waveformContainer.classList.remove("hidden");
    audioFiltersContainer.classList.remove("hidden");
    showPlaybackUI();
  }

  // --- Playback Logic ---
  function togglePlayback() {
    if (wavesurfer) {
      wavesurfer.playPause();
      playPauseBtn.textContent = wavesurfer.isPlaying()
        ? "pause"
        : "play_arrow";
    }
  }

  function updatePlaybackTimer() {
    if (wavesurfer) {
      const currentTime = wavesurfer.getCurrentTime();
      const currentMinutes = Math.floor(currentTime / 60);
      const currentSeconds = Math.floor(currentTime % 60);
      const currentTimeFormatted = `${currentMinutes}:${currentSeconds.toString().padStart(2, "0")}`;
      playbackTimer.textContent = `${currentTimeFormatted} / ${totalDurationFormatted}`;
    }
  }

  // --- Audio Processing ---
  /*async function processAndEncodeAudio(sourceBlob, filterType) {
    const tempAudioContext = new AudioContext();
    const response = await fetch(URL.createObjectURL(sourceBlob));
    const arrayBuffer = await response.arrayBuffer();
    const decodedData = await tempAudioContext.decodeAudioData(arrayBuffer);

    if (filterType === "ghost") {
      const transformedBuffer =
        await app.audioFilters.reverseReverbTransform(arrayBuffer);
      return app.crypto.audioBufferToWav(transformedBuffer);
    } else if (filterType === "optimusprime") {
      // Assuming optimusPrimeTransform is also a self-contained OfflineAudioContext filter
      // You will need to implement app.audioFilters.optimusPrimeTransform in audiofilters.js
      const transformedBuffer =
        await app.audioFilters.optimusPrimeTransform(arrayBuf);
      return app.crypto.audioBufferToWav(transformedBuffer);
    }

    const offlineCtx = new OfflineAudioContext(
      decodedData.numberOfChannels,
      decodedData.length,
      decodedData.sampleRate,
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedData;

    let filterNode = null;
    if (filterType === "lowpass") {
      filterNode = offlineCtx.createBiquadFilter();
      filterNode.type = "lowpass";
      filterNode.frequency.value = 1000;
      source.connect(filterNode);
      filterNode.connect(offlineCtx.destination);
    } else if (filterType === "highpass") {
      filterNode = offlineCtx.createBiquadFilter();
      filterNode.type = "highpass";
      filterNode.frequency.value = 800;
      source.connect(filterNode);
      filterNode.connect(offlineCtx.destination);
    } else if (filterType === "talkingtom") {
      source.playbackRate.value = 1.8;
      source.connect(offlineCtx.destination);
    } else {
      source.connect(offlineCtx.destination);
    }

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    return app.crypto.audioBufferToWav(renderedBuffer);
  }*/
  /**
   * Processes an AudioBuffer with a given filter and returns a WAV Blob.
   * This is used for both playback preview and final sending.
   * @param {AudioBuffer} sourceAudioBuffer - The raw AudioBuffer to process.
   * @param {string} filterType - The type of filter to apply.
   * @returns {Promise<Blob>} A promise that resolves to the filtered WAV Blob.
   */
  async function processAndEncodeAudio(sourceAudioBuffer, filterType) {
    document.getElementById("voice-ui-wrapper").classList.add("hidden");
    document.getElementById("voice-loading").classList.remove("hidden");
    // Some filters (like ghost and optimusprime) are self-contained and return
    // an AudioBuffer directly, handling their own OfflineAudioContext.
    // For these, we'll directly call them and convert their result to a WAV Blob.
    if (filterType === "ghost") {
      const transformedBuffer =
        await app.audioFilters.reverseReverbTransform(sourceAudioBuffer);
      document.getElementById("voice-ui-wrapper").classList.remove("hidden");
      document.getElementById("voice-loading").classList.add("hidden");
      return app.crypto.audioBufferToWav(transformedBuffer);
    } else if (filterType === "astronaut") {
      const transformedBuffer =
        await app.audioFilters.astronautTransform(sourceAudioBuffer);
      document.getElementById("voice-ui-wrapper").classList.remove("hidden");
      document.getElementById("voice-loading").classList.add("hidden");
      return app.crypto.audioBufferToWav(transformedBuffer);
    } else if (filterType === "church") {
      const transformedBuffer =
        await app.audioFilters.churchTransform(sourceAudioBuffer);
      document.getElementById("voice-ui-wrapper").classList.remove("hidden");
      document.getElementById("voice-loading").classList.add("hidden");
      return app.crypto.audioBufferToWav(transformedBuffer);
    } else if (filterType === "robot1") {
      const transformedBuffer =
        await app.audioFilters.robot1Transform(sourceAudioBuffer);
      document.getElementById("voice-ui-wrapper").classList.remove("hidden");
      document.getElementById("voice-loading").classList.add("hidden");
      return app.crypto.audioBufferToWav(transformedBuffer);
    }

    // For other filters (lowpass, highpass, talkingtom, none), we use a single OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(
      sourceAudioBuffer.numberOfChannels,
      sourceAudioBuffer.length,
      sourceAudioBuffer.sampleRate,
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceAudioBuffer;

    let filterNode = null;
    if (filterType === "lowpass") {
      filterNode = offlineCtx.createBiquadFilter();
      filterNode.type = "lowpass";
      filterNode.frequency.value = 1000;
      source.connect(filterNode);
      filterNode.connect(offlineCtx.destination);
    } else if (filterType === "highpass") {
      filterNode = offlineCtx.createBiquadFilter();
      filterNode.type = "highpass";
      filterNode.frequency.value = 800;
      source.connect(filterNode);
      filterNode.connect(offlineCtx.destination);
    } else if (filterType === "talkingtom") {
      source.playbackRate.value = 1.8; // Apply pitch shift for offline rendering
      source.connect(offlineCtx.destination);
    } else {
      // "none" filter or any other filter not explicitly handled
      source.connect(offlineCtx.destination);
    }

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    document.getElementById("voice-ui-wrapper").classList.remove("hidden");
    document.getElementById("voice-loading").classList.add("hidden");
    return app.crypto.audioBufferToWav(renderedBuffer);
  }

  /**
   * Processes the original recording with the given filter and loads it into Wavesurfer for playback.
   * @param {string} filterToApply - The filter type to apply.
   */
  async function loadFilteredAudioForPlayback(filterToApply) {
    if (!originalAudioBuffer) {
      console.warn("No original audio buffer available to load for playback.");
      return;
    }

    // Release previous object URL to prevent memory leaks
    if (currentPlaybackAudioUrl) {
      URL.revokeObjectURL(currentPlaybackAudioUrl);
    }

    // Process the audio with the selected filter
    const filteredWavBlob = await processAndEncodeAudio(
      originalAudioBuffer,
      filterToApply,
    );
    currentPlaybackAudioUrl = URL.createObjectURL(filteredWavBlob);

    // (Re)initialize Wavesurfer if needed and load the filtered audio
    if (!wavesurfer) {
      wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        height: "auto",
        barWidth: 2,
        barGap: 1,
        dragToSeek: true,
        plugins: [WaveSurfer.Regions.create({})],
      });
      // Update colors based on the current theme
      updateWaveformColors();

      wavesurfer.on("decode", () => {
        // Only initialize AudioContext once for real-time connections if needed
        if (!isAudioGraphInitialized) {
          audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
          sourceNode = audioContext.createMediaElementSource(
            wavesurfer.getMediaElement(),
          );
          // Connect sourceNode to destination by default; applyFilter will manage connections
          sourceNode.connect(audioContext.destination);
          isAudioGraphInitialized = true;
        }
        // Update total duration for playback timer
        const duration = wavesurfer.getDuration();
        const totalMinutes = Math.floor(duration / 60);
        const totalSeconds = Math.floor(duration % 60);
        totalDurationFormatted = `${totalMinutes}:${totalSeconds.toString().padStart(2, "0")}`;
        updatePlaybackTimer();
      });

      wavesurfer.on("timeupdate", () => {
        updatePlaybackTimer();
      });

      wavesurfer.on("finish", () => {
        playPauseBtn.textContent = "play_arrow";
        wavesurfer.seekTo(0);
        updatePlaybackTimer();
      });
    }

    wavesurfer.load(currentPlaybackAudioUrl);
  }

  async function fetchAudioBlobFromUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.error("Error fetching audio blob from URL:", error);
      return null;
    }
  }

  // --- Main Send Logic ---
  async function sendVoiceMessage(
    toForward = false,
    payload = null,
    forward_recipientId = null,
  ) {
    if (!toForward) {
      if (!app.state.currentChatUser) {
        return;
      }
    }

    const sendButton = document.getElementById("send-voice-message-btn");
    sendButton.disabled = true;

    try {
      let recipientId = null;
      let activeFilter = null;
      if (toForward) {
        console.log("Forwarding voice message");
        recipientId = forward_recipientId;
        activeFilter = "none";
      } else {
        recipientId = app.state.currentChatUser;
        activeFilter =
          document.querySelector(".filter-btn.active").dataset.filter;
      }

      // 1. Process and Encode audio to a WAV blob
      let wavBlob;
      if (toForward && payload) {
        // For forwarded messages, decrypt the existing payload
        const decryptedWavBuffer = await app.crypto.decryptVoicePayload(
          payload,
          app.state.myPrivateKey,
        );
        wavBlob = new Blob([decryptedWavBuffer], { type: "audio/wav" });
      } else {
        // For new messages, process the original recording with the currently active filter
        if (!originalAudioBuffer) {
          throw new Error("No recorded audio available to send.");
        }
        wavBlob = await processAndEncodeAudio(
          originalAudioBuffer,
          currentActiveFilter,
        );
      }

      // 5. Proceed with encryption and upload in the background
      const wavArrayBuffer = await wavBlob.arrayBuffer();
      const recipientPublicKeyJwk = app.state.publicKeyCache[recipientId];
      if (!recipientPublicKeyJwk) {
        throw new Error(`Public key for user ${recipientId} not found.`);
      }
      const myPublicKeyJwk = app.state.myPublicKey;
      if (!myPublicKeyJwk) {
        throw new Error("Your public key not found.");
      }

      const recipientPublicKey = await app.crypto.importPublicKeyFromJwk(
        recipientPublicKeyJwk,
      );
      const myPublicKey =
        await app.crypto.importPublicKeyFromJwk(myPublicKeyJwk);

      const aesKey = await app.crypto.generateAesKey();
      const { ciphertext: encryptedAudioBuffer, iv } =
        await app.crypto.aesEncrypt(wavArrayBuffer, aesKey);

      const aesKeyJwk = await app.crypto.exportKeyToJwk(aesKey);
      const aesKeyString = JSON.stringify(aesKeyJwk);

      const encryptedAesKeyForReceiver = await app.crypto.rsaEncrypt(
        new TextEncoder().encode(aesKeyString),
        recipientPublicKey,
      );
      const encryptedAesKeyForSender = await app.crypto.rsaEncrypt(
        new TextEncoder().encode(aesKeyString),
        myPublicKey,
      );

      //VoiceSendingLoader.addMessage("Uploading encrypted voice message...");
      const encryptedBlob = new Blob([encryptedAudioBuffer]);
      const localPayload = {
        encryptedBlob: encryptedBlob,
        iv: app.crypto.arrayBufferToBase64(iv),
        keys: [
          {
            userId: recipientId,
            key: app.crypto.arrayBufferToBase64(encryptedAesKeyForReceiver),
          },
          {
            userId: app.state.myUserId,
            key: app.crypto.arrayBufferToBase64(encryptedAesKeyForSender),
          },
        ],
      };
      const clientMessageId = app.crypto.generateClientMessageId();
      if (Number(recipientId) === Number(app.state.currentChatUser)) {
        if (toForward) {
          app.ui.displayMessage(
            clientMessageId,
            "me",
            localPayload,
            "pending",
            Date.now(),
            "forward-voice",
          );
        }
        if (!toForward) {
          app.ui.displayMessage(
            clientMessageId,
            "me",
            localPayload,
            "pending",
            Date.now(),
            "voice",
          );
        }
      }
      const formData = new FormData();
      formData.append("token", getCookie("auth_token"));
      formData.append("voiceMessage", encryptedBlob, "voice.bin");

      const response = await fetch("/backend/upload_voice_message.php", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      // 6. Send the pointer message via WebSocket
      const pointerPayload = {
        url: result.url,
        iv: app.crypto.arrayBufferToBase64(iv),
        keys: [
          {
            userId: recipientId,
            key: app.crypto.arrayBufferToBase64(encryptedAesKeyForReceiver),
          },
          {
            userId: app.state.myUserId,
            key: app.crypto.arrayBufferToBase64(encryptedAesKeyForSender),
          },
        ],
        timestamp: Date.now(),
      };

      if (toForward) {
        app.websocket.send(
          recipientId,
          pointerPayload,
          clientMessageId,
          "🎤 Voice Message",
          "forward-voice",
        );
        app.storage.saveMessageLocally(
          null,
          clientMessageId,
          recipientId,
          "me",
          pointerPayload,
          "pending",
          Date.now(),
          "forward-voice",
        );
      } else {
        app.websocket.send(
          recipientId,
          pointerPayload,
          clientMessageId,
          "🎤 Voice Message",
          "voice",
        );
        app.storage.saveMessageLocally(
          null,
          clientMessageId,
          recipientId,
          "me",
          pointerPayload,
          "pending",
          Date.now(),
          "voice",
        );
      }
      // 4. Reset the recording UI now that the local part is done
      showInitialUI();

      //VoiceSendingLoader.stop();
    } catch (error) {
      console.error("Failed to send voice message:", error);
      alert(`Error sending voice message: ${error.message}`);
      //VoiceSendingLoader.stop();
    } finally {
      sendButton.disabled = false;
    }
  }

  /**
   * Sets up all the main event listeners for the application.
   */
  function initializeEventListeners() {
    document.addEventListener("themeChanged", updateWaveformColors);

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        const filterType = button.dataset.filter;
        applyFilter(filterType);
      });
    });

    // --- Voice Message Button Listeners ---
    recordButton.addEventListener("click", startRecording);
    pauseResumeBtn.addEventListener("click", togglePauseResume);
    stopRecordingBtn.addEventListener("click", stopRecording);
    cancelRecordingBtn.addEventListener("click", showInitialUI);
    playPauseBtn.addEventListener("click", togglePlayback);
    deleteRecordingBtn.addEventListener("click", showInitialUI);
    sendVoiceMessageBtn.addEventListener("click", () => {
      sendVoiceMessage();
    });

    document.addEventListener("messageReceived", async (e) => {
      console.log("RAW MESSAGE RECEIVED:", e.detail); // Enhanced debugging
      const { senderId, message_id, message_type, payload } = e.detail;

      if (!payload) {
        console.error("Received message with no payload.", e.detail);
        return;
      }

      if (!app.state.myPrivateKey) throw new Error("Private key not loaded.");

      const myKeyData = payload.keys.find(
        (k) => Number(k.userId) === Number(app.state.myUserId),
      );
      if (!myKeyData)
        throw new Error("No key found for the user in the payload.");

      const encryptedKey = app.crypto.base64ToArrayBuffer(myKeyData.key);
      const iv = app.crypto.base64ToArrayBuffer(payload.iv);
      const decryptedAesKeyData = await app.crypto.rsaDecrypt(
        encryptedKey,
        app.state.myPrivateKey,
      );
      const aesKeyJwk = JSON.parse(
        new TextDecoder().decode(decryptedAesKeyData),
      );
      const aesKey = await app.crypto.importAesKeyFromJwk(aesKeyJwk);

      let messageForDisplay;
      let contentForUI;
      switch (message_type) {
        case "voice":
          messageForDisplay = "🎤 Voice Message";
          contentForUI = payload; // Pass the pointer payload directly to the UI
          break;
        case "forward-voice":
          messageForDisplay = "🎤 Forwarded Voice Message";
          contentForUI = payload; // Pass the pointer payload directly to the UI
          break;

        case "text":
        default: // Fallback to text for safety
          try {
            if (message_type !== "text") {
              console.warn(
                `Unknown message_type: '${message_type}'. Treating as text.`,
              );
            }
            const ciphertext = app.crypto.base64ToArrayBuffer(
              payload.ciphertext,
            );
            messageForDisplay = await app.crypto.aesDecrypt(
              ciphertext,
              aesKey,
              iv,
            );
            contentForUI = messageForDisplay;
          } catch (error) {
            console.error("Decryption failed:", error);
            messageForDisplay = "🔒 [Could not decrypt message]";
            contentForUI = messageForDisplay;
          }
          break;
      }

      // Save the message locally for history
      // TO.DO Need to fix this for incoming voice messages
      app.storage.saveMessageLocally(
        message_id,
        null,
        senderId,
        "them",
        contentForUI,
        null,
        payload.timestamp || Date.now(),
        message_type || "text", // Ensure we save a type
      );

      // If the relevant chat is open, display the message
      if (Number(app.state.currentChatUser) === Number(senderId)) {
        app.ui.displayMessage(
          message_id,
          "them",
          contentForUI,
          null,
          payload.timestamp || Date.now(),
          message_type,
        );
      }
    });

    // Listener to rebuild the contact list UI when contacts are loaded/updated.
    document.addEventListener("contactsLoaded", () => {
      const list = document.getElementById("user-list");
      list.innerHTML = "";

      if (app.state.allContacts.length === 0 && window.innerWidth < 768) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "empty-chat-list";
        emptyMessage.innerHTML = `<p>No contacts yet!</p><p>Click the <span class="material-icons">person_search</span> button to find people.</p>`;
        list.appendChild(emptyMessage);
        return;
      }

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
        let lastMsgText;
        if (lastMsg) {
          console.log(lastMsg);
          if (
            lastMsg.messageType === "voice" ||
            lastMsg.messageType === "forward-voice"
          ) {
            lastMsgText = "🎤 Voice Message";
          } else {
            lastMsgText = lastMsg.payload.replace(
              new RegExp("[\\n\\r]", "g"),
              " ",
            );
          }
        } else {
          lastMsgText = "Tap to chat";
        }
        const useravatar = contact.profile_picture_url
          ? `<img src="/${contact.profile_picture_url}" class="contact-avatar" data-contact-id="${contact.id}">`
          : `<div class="contact-avatar">${contact.username.charAt(0).toUpperCase()}</div>`;
        contactDiv.innerHTML = `
          ${useravatar}
          <div class="contact-info">
              <div class="contact-name">${contact.display_name}</div>
              <div class="contact-lastmsg">${lastMsgText}</div>
          </div>
        `;
        contactDiv.onclick = () => app.ui.openChatWith(contact);

        list.appendChild(contactDiv);
        if (app.state.unreadCounts[contact.id] > 0) {
          app.ui.updateUnreadBadge(contact.id);
        }
      });

      // Wait for all profile pictures to load AND RENDER ---
      const images = list.querySelectorAll("img.contact-avatar");
      const imageLoadPromises = Array.from(images).map((img) => {
        return new Promise((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => {
              console.warn(
                `Failed to load image for contact ID: ${img.dataset.contactId}`,
              );
              // Find the contact data to get the username for the fallback avatar
              const contact = app.state.allContacts.find(
                (c) => c.id == img.dataset.contactId,
              );
              if (contact && img.parentElement) {
                const fallbackAvatar = document.createElement("div");
                fallbackAvatar.className = "contact-avatar";
                fallbackAvatar.textContent = contact.username
                  .charAt(0)
                  .toUpperCase();
                img.replaceWith(fallbackAvatar);
              }
              resolve();
            }; // Resolve on error too
          }
        });
      });
      // After all images have downloaded, wait for the next browser paint cycle.
      Promise.all(imageLoadPromises).then(() => {
        requestAnimationFrame(() => {
          // This code runs just before the browser repaints the screen.
          console.log(
            "✅ All contacts and images are fully loaded and rendered.",
          );
          // --- NEW: Trigger the specific event ---
          triggerEvent("profilePicturesReady");
        });
      });
    });

    // Listener to update a contact's last message preview.
    document.addEventListener("lastMessageUpdated", (e) => {
      const { contactId, sender, message, timestamp } = e.detail;
      const list = document.getElementById("user-list");
      const card = list.querySelector(`[data-contact-id="${contactId}"]`);

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
              triggerEvent("contactsLoaded");
            }
          });
      } else if (card) {
        card.querySelector(".contact-lastmsg").textContent = message.replace(
          new RegExp("[\\n\\r]", "g"),
          " ",
        );
        if (list.firstChild !== card) {
          list.prepend(card);
        }
      }
      if (sender === "me") {
        return;
      }
      // If the chat is not open, increment the unread count
      if (Number(app.state.currentChatUser) !== Number(contactId)) {
        app.state.unreadCounts[contactId] =
          (app.state.unreadCounts[contactId] || 0) + 1;
        app.ui.updateUnreadBadge(contactId);
      }
    });

    document.addEventListener("messageIDReceived", (e) => {
      const { chat_id, client_message_id, message_id, message_status } =
        e.detail;
      app.storage.updateClientMessageId(
        chat_id,
        client_message_id,
        message_id,
        message_status,
      );
    });
    document.addEventListener("messageStatusACK", (e) => {
      const { chat_id, message_id, message_status } = e.detail;
      app.storage.updateMessageStatus(chat_id, message_id, message_status);
    });
  }

  // Expose functions on the global app object.
  app.events.sendVoiceMessage = sendVoiceMessage;
  app.events.trigger = triggerEvent;
  app.events.initialize = initializeEventListeners;
})(app);
