const button = document.createElement('button');
button.id = 'rain-sound';
button.type = 'button';
button.textContent = 'Rain sound · Off';
button.setAttribute('aria-pressed', 'false');
document.querySelector('nav').append(button);
let context, volume, enabled = false, intensity = .4;
function updateVolume() {
  if (!context) return;
  volume.gain.setTargetAtTime(enabled && !document.hidden ? .12 + intensity * .16 : 0, context.currentTime, .5);
}
button.addEventListener('click', async () => {
  try {
    if (!context) {
      context = new AudioContext();
      volume = context.createGain();
      volume.gain.value = 0;
      volume.connect(context.destination);
      const buffer = context.createBuffer(2, context.sampleRate * 7, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let low = 0;
        for (let i = 0; i < data.length; i++) {
          const noise = Math.random() * 2 - 1;
          low = low * .97 + noise * .03;
          data[i] = noise * .32 + low * 1.5;
        }
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4200;
      source.connect(filter).connect(volume);
      source.start();
    }
    await context.resume();
    enabled = !enabled;
    button.textContent = 'Rain sound · ' + (enabled ? 'On' : 'Off');
    button.setAttribute('aria-pressed', String(enabled));
    updateVolume();
  } catch {
    button.textContent = 'Sound unavailable';
  }
});
document.addEventListener('rain-intensity', event => {
  intensity = event.detail;
  updateVolume();
});
document.addEventListener('visibilitychange', updateVolume);
