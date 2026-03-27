/**
 * Emergency symptom keywords. If detected in user message, show urgent alert.
 */
const EMERGENCY_PATTERNS = [
  /\bchest\s+pain\b/i,
  /\bsevere\s+chest\s+pain\b/i,
  /\bdifficulty\s+breathing\b/i,
  /\bcan'?t\s+breathe\b/i,
  /\btrouble\s+breathing\b/i,
  /\bshortness\s+of\s+breath\b/i,
  /\bstroke\b/i,
  /\bnumbness\s+(in|on)\s+(face|arm|leg)/i,
  /\bsevere\s+bleeding\b/i,
  /\bunconscious\b/i,
  /\bpassed\s+out\b/i,
  /\bnot\s+breathing\b/i,
  /\bchoking\b/i,
  /\bseizure\b/i,
  /\bsuicidal\b/i,
  /\bsuicide\b/i,
  /\bsevere\s+allergic\s+reaction\b/i,
  /\banaphylax/i,
  /\bsevere\s+head\s+injury\b/i,
  /\bsudden\s+severe\s+headache\b/i,
  /\battempting\s+to\s+hurt\s+(myself|self)\b/i,
];

export function detectEmergencySymptom(message: string): boolean {
  if (!message?.trim()) return false;
  return EMERGENCY_PATTERNS.some((re) => re.test(message));
}
