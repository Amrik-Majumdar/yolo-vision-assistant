let speechSpeed = 1.0;

export function speak(text) {
  try {
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speechSpeed;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
    
  } catch (error) {
    console.error("Speech failed:", error);
  }
}

export function setSpeechRate(rate) {
  speechSpeed = rate;
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}