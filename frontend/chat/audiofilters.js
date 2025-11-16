(function (app) {
  // Define AudioContext for compatibility
  self.AudioContext = self.AudioContext || self.webkitAudioContext;

  /**
   * Helper function to create a reversed AudioBuffer.
   * Defined internally to reverseReverbTransform as it's a specific utility for it.
   */
  function createReversedAudioBuffer(audioBuffer) {
    let ctx = new AudioContext();
    // copy audiobuffer
    let reversedAudioBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      reversedAudioBuffer.copyToChannel(audioBuffer.getChannelData(i), i);
    }

    // reverse new audiobuffer
    for (let i = 0; i < reversedAudioBuffer.numberOfChannels; i++) {
      reversedAudioBuffer.getChannelData(i).reverse();
    }
    return reversedAudioBuffer;
  }

  /**
   * Applies a reverse reverb transform (ghost effect) to an AudioBuffer.
   * @param {AudioBuffer} audioBuffer - The input audio buffer.
   * @returns {Promise<AudioBuffer>} A promise that resolves to the transformed audio buffer.
   */
  async function reverseReverbTransform(audioBuffer) {
    let ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    let reversedAudioBuffer = createReversedAudioBuffer(audioBuffer);

    let source = ctx.createBufferSource();
    source.buffer = reversedAudioBuffer;

    let convolver = ctx.createConvolver();
    convolver.buffer = await ctx.decodeAudioData(
      await (await fetch("../assets/audio/parking_garage.wav")).arrayBuffer(),
    );
    // convolver.buffer = await ctx.decodeAudioData(await (await fetch("../audio/impulse-responses/church.wav")).arrayBuffer());

    let outCompressor = ctx.createDynamicsCompressor();

    source.connect(convolver);
    convolver.connect(outCompressor);

    //dry
    let dryGain = ctx.createGain();
    dryGain.gain.value = 0.5;
    source.connect(dryGain);
    dryGain.connect(outCompressor);
    outCompressor.connect(ctx.destination);

    source.start(0);
    return createReversedAudioBuffer(await ctx.startRendering());
  }

  async function astronautTransform(audioBuffer, distortionAmount = 50) {
    let ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    // Source
    let source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Wave shaper
    let waveShaper = ctx.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(distortionAmount);
    function makeDistortionCurve(amount) {
      var k = typeof amount === "number" ? amount : 50;
      var n_samples = 44100;
      var curve = new Float32Array(n_samples);
      var deg = Math.PI / 180;
      var x;
      for (let i = 0; i < n_samples; ++i) {
        x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }

    // Filter
    let filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1300;

    // Initial distortion
    source.connect(filter);
    filter.connect(waveShaper);

    // Telephone effect
    let lpf1 = ctx.createBiquadFilter();
    lpf1.type = "lowpass";
    lpf1.frequency.value = 2000.0;
    let lpf2 = ctx.createBiquadFilter();
    lpf2.type = "lowpass";
    lpf2.frequency.value = 2000.0;
    let hpf1 = ctx.createBiquadFilter();
    hpf1.type = "highpass";
    hpf1.frequency.value = 500.0;
    let hpf2 = ctx.createBiquadFilter();
    hpf2.type = "highpass";
    hpf2.frequency.value = 500.0;
    let compressor = ctx.createDynamicsCompressor();
    lpf1.connect(lpf2);
    lpf2.connect(hpf1);
    hpf1.connect(hpf2);
    hpf2.connect(compressor);
    compressor.connect(ctx.destination);

    // Connect distorter to telephone effect
    waveShaper.connect(lpf1);

    // Render
    source.start();
    let outputAudioBuffer = await ctx.startRendering();
    return outputAudioBuffer;
  }

  async function churchTransform(audioBuffer) {
    let ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    // Source
    let source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Reverb
    let convolver = ctx.createConvolver();
    convolver.buffer = await ctx.decodeAudioData(
      await (await fetch("../assets/audio/church.wav")).arrayBuffer(),
    );

    // Create graph
    source.connect(convolver);
    convolver.connect(ctx.destination);

    // Render
    source.start();
    let outputAudioBuffer = await ctx.startRendering();
    return outputAudioBuffer;
  }

  async function robot1Transform(audioBuffer) {
    let ctx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );

    // Source
    let source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Wobble
    let oscillator1 = ctx.createOscillator();
    oscillator1.frequency.value = 50;
    oscillator1.type = "sawtooth";
    let oscillator2 = ctx.createOscillator();
    oscillator2.frequency.value = 500;
    oscillator2.type = "sawtooth";
    let oscillator3 = ctx.createOscillator();
    oscillator3.frequency.value = 50;
    oscillator3.type = "sawtooth";
    // ---
    let oscillatorGain = ctx.createGain();
    oscillatorGain.gain.value = 0.004;
    // ---
    let delay = ctx.createDelay();
    delay.delayTime.value = 0.01;

    // Create graph
    oscillator1.connect(oscillatorGain);
    oscillator2.connect(oscillatorGain);
    // oscillator3.connect(oscillatorGain);
    oscillatorGain.connect(delay.delayTime);
    // ---
    source.connect(delay);
    delay.connect(ctx.destination);

    // Render
    oscillator1.start(0);
    oscillator2.start(0);
    oscillator3.start(0);
    source.start(0);
    // fire.start(0);
    let outputAudioBuffer = await ctx.startRendering();
    return outputAudioBuffer;
  }

  // Expose the filter function on the app.audioFilters namespace
  app.audioFilters = app.audioFilters || {};
  app.audioFilters.reverseReverbTransform = reverseReverbTransform;
  app.audioFilters.astronautTransform = astronautTransform;
  app.audioFilters.churchTransform = churchTransform;
  app.audioFilters.robot1Transform = robot1Transform;
})((window.app = window.app || {}));
