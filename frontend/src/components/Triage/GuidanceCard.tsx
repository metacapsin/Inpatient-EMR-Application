import React, { useMemo } from 'react';

export interface GuidanceCardProps {
  guidance: string;
  /** When provided, bullets matching this text are excluded from "Contact a doctor if" (shown in Note below). */
  disclaimer?: string;
  className?: string;
}

function toBullets(text: string): string[] {
  if (!text?.trim()) return [];
  const byNewline = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const bySentence = text.split(/\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySentence.length <= 1) return text.trim() ? [text.trim()] : [];
  return bySentence.map((s) => (s.endsWith('.') ? s : `${s}.`));
}

const DOCTOR_SECTION_MARKERS = [
  /contact\s+(a\s+)?(doctor|physician|provider|healthcare)/i,
  /see\s+(a\s+)?(doctor|physician|provider)/i,
  /seek\s+(medical|emergency|care|attention)/i,
  /call\s+(your\s+)?(doctor|provider)/i,
  /call\s+911/i,
  /get\s+medical\s+(help|care|attention)/i,
  /go\s+to\s+(the\s+)?(er|emergency|urgent)/i,
  /(emergency|urgent)\s+care/i,
];

function splitGuidanceAndDoctorSection(guidance: string): { guidance: string; doctorSection: string } {
  const g = guidance.trim();
  if (!g) return { guidance: '', doctorSection: '' };
  let doctorIndex = -1;
  let usedMarker = '';
  for (const re of DOCTOR_SECTION_MARKERS) {
    const m = g.match(re);
    if (m && m.index !== undefined) {
      if (doctorIndex < 0 || m.index < doctorIndex) {
        doctorIndex = m.index;
        usedMarker = m[0];
      }
    }
  }
  if (doctorIndex < 0) return { guidance: g, doctorSection: '' };
  const before = g.slice(0, doctorIndex).trim();
  const after = g.slice(doctorIndex).trim();
  return { guidance: before, doctorSection: after };
}

function isDisclaimerBullet(bullet: string, disclaimer: string | undefined): boolean {
  if (!disclaimer?.trim()) return false;
  const d = disclaimer.trim();
  const b = bullet.trim();
  if (b === d) return true;
  if (b.includes(d) || d.includes(b)) return true;
  return false;
}

export const GuidanceCard: React.FC<GuidanceCardProps> = ({ guidance, disclaimer, className = '' }) => {
  const { guidance: mainGuidance, doctorSection } = useMemo(() => splitGuidanceAndDoctorSection(guidance), [guidance]);
  const bullets = useMemo(() => toBullets(mainGuidance), [mainGuidance]);
  const doctorBullets = useMemo(
    () => toBullets(doctorSection).filter((b) => !isDisclaimerBullet(b, disclaimer)),
    [doctorSection, disclaimer]
  );

  if (bullets.length === 0 && doctorBullets.length === 0) {
    if (guidance?.trim()) {
      const fallback = toBullets(guidance);
      if (fallback.length === 0) return null;
    } else return null;
  }

  return (
    <section
      aria-labelledby="triage-guidance-heading"
      className={`rounded-lg border border-blue-200/70 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/25 p-3.5 sm:p-4 space-y-3 ${className}`}
    >
      {bullets.length > 0 && (
        <>
          <h3 id="triage-guidance-heading" className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">
            Guidance
          </h3>
          <ul className="space-y-2 text-slate-800 dark:text-slate-200 text-sm leading-relaxed list-none pl-0" role="list">
            {bullets.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800/60 flex items-center justify-center mt-0.5" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {doctorBullets.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 uppercase tracking-wide">
            Contact a doctor if
          </h4>
          <ul className="space-y-2 text-slate-800 dark:text-slate-200 text-sm leading-relaxed list-none pl-0" role="list">
            {doctorBullets.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800/60 flex items-center justify-center mt-0.5" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default GuidanceCard;
