let synth = null;

function ensureSynth() {
  if (!synth) {
    synth = window.speechSynthesis;
  }
  return synth;
}

function getEnglishVoice() {
  const voices = ensureSynth().getVoices();
  return voices.find(v => v.lang === 'en-US' && v.name.includes('Samantha'))
    || voices.find(v => v.lang === 'en-US')
    || voices.find(v => v.lang.startsWith('en-'))
    || voices.find(v => v.lang.startsWith('en'))
    || null;
}

export function speak(text, rate = 0.85) {
  return new Promise((resolve) => {
    const s = ensureSynth();
    s.cancel();

    // Chrome workaround: resume if paused/stuck
    if (s.paused) {
      s.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const voice = getEnglishVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.warn('TTS error:', e.error);
      resolve();
    };

    s.speak(utterance);

    // Chrome bug: speechSynthesis can get stuck, keep it alive
    const keepAlive = setInterval(() => {
      if (!s.speaking) {
        clearInterval(keepAlive);
      } else {
        s.pause();
        s.resume();
      }
    }, 10000);

    utterance.onend = () => {
      clearInterval(keepAlive);
      resolve();
    };
    utterance.onerror = (e) => {
      clearInterval(keepAlive);
      console.warn('TTS error:', e.error);
      resolve();
    };
  });
}

export function speakSlow(text) {
  return speak(text, 0.2);
}

export function stop() {
  if (synth) {
    synth.cancel();
  }
}

export function preloadVoices() {
  return new Promise((resolve) => {
    const s = ensureSynth();
    if (!s) {
      resolve();
      return;
    }
    const voices = s.getVoices();
    if (voices.length > 0) {
      resolve();
      return;
    }
    s.onvoiceschanged = () => resolve();
    // Timeout: don't block rendering if voices never load
    setTimeout(resolve, 2000);
  });
}
