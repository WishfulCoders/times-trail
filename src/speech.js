// Read-aloud for players who are still learning to read. Browsers default to
// their oldest, most robotic voice, so prefer the natural-sounding ones.

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

function score(voice) {
  const name = voice.name.toLowerCase()
  let s = 0
  if (/natural|neural|premium|enhanced/.test(name)) s += 4
  if (name.includes('google')) s += 3
  if (name.includes('samantha') || name.includes('karen') || name.includes('daniel')) s += 2
  if (name.includes('compact')) s -= 3
  if (voice.localService) s += 1
  if (/^en-(us|gb|au|ca)/i.test(voice.lang)) s += 1
  return s
}

function bestVoice() {
  const voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang))
  return voices.sort((x, y) => score(y) - score(x))[0] || null
}

export function speak(text) {
  if (!canSpeak() || !text) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = bestVoice()
  if (voice) utterance.voice = voice
  utterance.rate = 0.92
  synth.speak(utterance)
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

// What the read-aloud button says for each kind of question.
export function spokenQuestion(item) {
  const { a, b, mode } = item
  if (mode === 'groups') return `${a} rows of ${b}. How many altogether?`
  if (mode === 'skip') return `Count by ${a}s. Which number is missing?`
  if (mode === 'missing') return `${a} times what makes ${a * b}?`
  return `What is ${a} times ${b}?`
}
