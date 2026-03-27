/**
 * Generates human-readable answers from FaceSheet API data for the AI Chat Assistant.
 * Maps natural language questions to FaceSheet sections and formats the response.
 */

export interface FaceSheetData {
  vitals?: any[];
  diagnoses?: any[];
  History?: any[];
  medications?: any[];
  prescriptions?: any[];
  allergies?: any[];
  immunizations?: any[];
  documents?: any[];
  labDocuments?: any[];
  notes?: any[];
  screening?: any[];
  futureAppointments?: any[];
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

function formatHeight(feet: number, inches: number): string {
  if (!feet && !inches) return '--';
  const totalInches = feet * 12 + inches;
  const cm = (totalInches * 2.54).toFixed(1);
  return `${feet}'${inches}" / ${cm} cm`;
}

function answerMedications(data: FaceSheetData): string {
  const list = data.medications || [];
  if (list.length === 0) return 'No current medications on record.';
  const lines = list.map((m: any, i: number) => {
    const name = m?.drugName?.[0] || m?.medicationName || 'Unknown';
    const dosage = m?.dosage?.[0] || m?.dosage || 'N/A';
    const qty = m?.quantity?.[0] || m?.quantity;
    return `${i + 1}. ${name} — ${dosage}${qty ? ` (${qty})` : ''}`;
  });
  return 'Current medications:\n\n' + lines.join('\n');
}

function answerMedicalHistory(data: FaceSheetData): string {
  const list = data.History || [];
  if (list.length === 0) return 'No medical history on record.';
  const lines = list.map((h: any, i: number) => {
    const condition = h?.conditions || 'Unknown';
    const category = h?.category?.name || '';
    const date = h?.diagonosisDate ? formatDate(h.diagonosisDate) : '';
    const notes = h?.notes ? ` — ${h.notes}` : '';
    return `${i + 1}. ${condition}${category ? ` (${category})` : ''}${date ? ` — ${date}` : ''}${notes}`;
  });
  return 'Medical history:\n\n' + lines.join('\n');
}

function answerAllergies(data: FaceSheetData): string {
  const list = data.allergies || [];
  if (list.length === 0) return 'No allergies on record.';
  const lines = list.map((a: any, i: number) => {
    const name = a.name || a.allergyName || 'Unknown';
    const severity = a.severity || 'N/A';
    const reaction = a.reaction || '';
    return `${i + 1}. ${name} (${severity})${reaction ? ` — ${reaction}` : ''}`;
  });
  return 'Allergies to be aware of:\n\n' + lines.join('\n');
}

function answerVitals(data: FaceSheetData): string {
  const list = data.vitals || [];
  if (list.length === 0) return 'No recent vital signs on record.';
  const latest = list[0];
  const date = latest.vitalsRecordedDate ? formatDate(latest.vitalsRecordedDate) : 'N/A';
  const heightStr = formatHeight(
    latest.vitalsHeightInFeet || 0,
    latest.vitalsHeightInInch || 0
  );
  const parts: string[] = [
    `Most recent vitals (${date}):`,
    `• Blood pressure: ${latest.vitalsSystolicBloodPressure || '--'}/${latest.vitalsDiastolicBloodPressure || '--'} mmHg`,
    `• Heart rate: ${latest.vitalsHeartRate || '--'} bpm`,
    `• Temperature: ${latest.vitalsTemperature || '--'} °F`,
    `• Weight: ${latest.vitalsWeightLbs ? `${latest.vitalsWeightLbs} lbs` : '--'} ${latest.vitalsWeightKg ? `/ ${latest.vitalsWeightKg} kg` : ''}`,
    `• SpO₂: ${latest.vitalsSpO2 || '--'}%`,
    `• Respiratory rate: ${latest.vitalsRespiratoryRate || '--'} /min`,
    `• BMI: ${latest.vitalsBodyMassIndex || '--'}`,
    `• Height: ${heightStr}`,
  ];
  if (latest.fastingBloodSugar != null) parts.push(`• Fasting blood sugar: ${latest.fastingBloodSugar} mg/dL`);
  if (latest.postprandialBloodSugar != null) parts.push(`• Postprandial blood sugar: ${latest.postprandialBloodSugar} mg/dL`);
  if (list.length > 1) parts.push(`\n(${list.length} total vital records on file.)`);
  return parts.join('\n');
}

function answerDiagnoses(data: FaceSheetData): string {
  const list = data.diagnoses || [];
  if (list.length === 0) return 'No diagnoses on record.';
  const lines = list.map((d: any, i: number) => {
    const code = d?.code || 'N/A';
    const desc = d?.description || 'No description';
    return `${i + 1}. [${code}] ${desc}`;
  });
  return 'Diagnoses:\n\n' + lines.join('\n');
}

function getNotePreviewText(note: any): string {
  if (note?.notesType === 'SOAP Note' || note?.notesType?.toLowerCase?.().includes('soap')) {
    return note?.subjective || note?.soapContent?.subjective || note?.notesText || '';
  }
  return note?.notesText || '';
}

function answerSummarizeNotes(data: FaceSheetData): string {
  const list = data.notes || [];
  if (list.length === 0) return 'No clinical notes on record.';
  const lines = list.map((n: any, i: number) => {
    const type = n?.notesType || 'Note';
    const date = n?.date ? formatDate(n.date) : 'N/A';
    const provider = n?.assignedProvider?.name || 'N/A';
    const preview = getNotePreviewText(n);
    const short = preview.length > 120 ? preview.slice(0, 120) + '...' : preview;
    return `${i + 1}. ${type} (${date}) — ${provider}\n   ${short || 'No preview'}`;
  });
  return 'Summary of all notes:\n\n' + lines.join('\n\n');
}

function answerRecentNotes(data: FaceSheetData): string {
  const list = [...(data.notes || [])].sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return db - da;
  }).slice(0, 10);
  if (list.length === 0) return 'No recent notes on record.';
  const lines = list.map((n: any, i: number) => {
    const type = n?.notesType || 'Note';
    const date = n?.date ? formatDate(n.date) : 'N/A';
    const provider = n?.assignedProvider?.name || 'N/A';
    const preview = getNotePreviewText(n);
    const short = preview.length > 80 ? preview.slice(0, 80) + '...' : preview;
    return `${i + 1}. ${type} — ${date} — ${provider}\n   ${short || 'No preview'}`;
  });
  return 'Recent notes:\n\n' + lines.join('\n\n');
}

function answerNoteTrends(data: FaceSheetData): string {
  const list = data.notes || [];
  if (list.length === 0) return 'No notes available to analyze trends.';
  const byType: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  list.forEach((n: any) => {
    const type = n?.notesType || 'Other';
    byType[type] = (byType[type] || 0) + 1;
    if (n?.date) {
      const d = new Date(n.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
  });
  const typeLines = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `• ${t}: ${c}`);
  const monthLines = Object.entries(byMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([m, c]) => `• ${m}: ${c} note(s)`);
  return (
    `Note trends (${list.length} total notes):\n\n` +
    `By type:\n${typeLines.join('\n')}\n\n` +
    `Recent activity by month:\n${monthLines.join('\n')}`
  );
}

function answerLatestClinicalNotes(data: FaceSheetData): string {
  const list = [...(data.notes || [])].sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return db - da;
  }).slice(0, 5);
  if (list.length === 0) return 'No latest clinical notes on record.';
  const lines = list.map((n: any, i: number) => {
    const type = n?.notesType || 'Clinical Note';
    const date = n?.date ? formatDate(n.date) : 'N/A';
    const provider = n?.assignedProvider?.name || 'N/A';
    const preview = getNotePreviewText(n);
    const short = preview.length > 100 ? preview.slice(0, 100) + '...' : preview;
    return `${i + 1}. ${type} (${date}) — ${provider}\n   ${short || 'No content'}`;
  });
  return 'Latest clinical notes:\n\n' + lines.join('\n\n');
}

function answerHighlightFindings(data: FaceSheetData): string {
  const list = data.notes || [];
  if (list.length === 0) return 'No notes available to highlight findings.';
  const findings: string[] = [];
  list.forEach((n: any) => {
    const type = n?.notesType || 'Note';
    const date = n?.date ? formatDate(n.date) : '';
    const text = getNotePreviewText(n) || (n?.objective || n?.assessment || n?.plan || '');
    if (text) {
      const snippet = text.length > 150 ? text.slice(0, 150) + '...' : text;
      findings.push(`• [${type}${date ? `, ${date}` : ''}] ${snippet}`);
    }
  });
  if (findings.length === 0) return 'No notable findings extracted from notes.';
  return 'Important findings from notes:\n\n' + findings.slice(0, 15).join('\n\n');
}

function answerProgressNotesTimeline(data: FaceSheetData): string {
  const list = [...(data.notes || [])].filter(
    (n: any) =>
      (n?.notesType || '').toLowerCase().includes('progress') ||
      (n?.notesType || '').toLowerCase().includes('soap') ||
      (n?.notesType || '').toLowerCase().includes('clinical')
  );
  if (list.length === 0) {
    const all = data.notes || [];
    if (all.length === 0) return 'No progress notes on record.';
    list.push(...all);
  }
  const sorted = [...list].sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });
  const lines = sorted.map((n: any, i: number) => {
    const type = n?.notesType || 'Note';
    const date = n?.date ? formatDate(n.date) : 'N/A';
    const time = n?.time || '';
    const provider = n?.assignedProvider?.name || 'N/A';
    return `${i + 1}. ${date} ${time} — ${type} — ${provider}`;
  });
  return 'Progress notes timeline:\n\n' + lines.join('\n');
}

/** Normalize question for matching (lowercase, trim). */
function normalizeQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Map a question (or quick-question text) to an answer using FaceSheet data.
 * Returns a plain-text answer; handles unknown questions with a fallback.
 */
export function generateAnswer(question: string, data: FaceSheetData): string {
  const n = normalizeQuestion(question);

  if (n.includes('medication') && (n.includes('current') || n.includes('what are'))) return answerMedications(data);
  if (n.includes('medical history') || n.includes('patient\'s history')) return answerMedicalHistory(data);
  if (n.includes('allerg') && (n.includes('aware') || n.includes('any'))) return answerAllergies(data);
  if (n.includes('vital') && (n.includes('recent') || n.includes('sign'))) return answerVitals(data);
  if (n.includes('diagnos') && (n.includes('given') || n.includes('patient'))) return answerDiagnoses(data);
  if (n.includes('summarize') && n.includes('note')) return answerSummarizeNotes(data);
  if (n.includes('recent note') || n.includes('show recent note')) return answerRecentNotes(data);
  if (n.includes('analyze') && n.includes('trend')) return answerNoteTrends(data);
  if (n.includes('latest') && (n.includes('clinical') || n.includes('note'))) return answerLatestClinicalNotes(data);
  if (n.includes('highlight') && (n.includes('finding') || n.includes('important'))) return answerHighlightFindings(data);
  if (n.includes('progress note') && n.includes('timeline')) return answerProgressNotesTimeline(data);

  // Fallback: try to answer from the most relevant section
  if (n.includes('medication')) return answerMedications(data);
  if (n.includes('allerg')) return answerAllergies(data);
  if (n.includes('vital')) return answerVitals(data);
  if (n.includes('diagnos')) return answerDiagnoses(data);
  if (n.includes('history') && !n.includes('note')) return answerMedicalHistory(data);
  if (n.includes('note')) {
    if (n.includes('trend')) return answerNoteTrends(data);
    if (n.includes('recent') || n.includes('latest')) return answerLatestClinicalNotes(data);
    if (n.includes('timeline')) return answerProgressNotesTimeline(data);
    if (n.includes('summar') || n.includes('all')) return answerSummarizeNotes(data);
    if (n.includes('finding') || n.includes('important')) return answerHighlightFindings(data);
    return answerSummarizeNotes(data);
  }

  return "I can answer questions about current medications, medical history, allergies, recent vitals, diagnoses, and clinical notes (e.g. summarize all notes, show recent notes, analyze note trends, latest clinical notes, highlight important findings, progress notes timeline). Please ask one of those or click a quick question.";
}
