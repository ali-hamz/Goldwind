import type { Alert, AlertCategory, Level } from './alerts';

/**
 * Generic HSE weather precautions. This is good-practice guidance only; it
 * must be read together with (and is overridden by) the approved site
 * procedures, permit-to-work system and client requirements.
 */
export const PRECAUTIONS: Record<AlertCategory, { title: string; items: string[] }> = {
  heat: {
    title: 'High temperature – heat stress',
    items: [
      'Implement the site heat stress prevention programme.',
      'Ensure cool drinking water is available at all work locations.',
      'Provide shaded / cooled rest areas.',
      'Apply work–rest arrangements as per the approved procedure.',
      'Carry out WBGT monitoring where required by procedure (WBGT is not provided by this system).',
      'Schedule strenuous work for cooler periods where practicable; buddy system for heat illness signs.',
    ],
  },
  wind: {
    title: 'High wind – lifting and work at height',
    items: [
      'Review all planned lifting operations against current and forecast wind.',
      "Follow the crane / lifting equipment manufacturer's wind-speed limitations.",
      'Monitor wind conditions continuously during lifting (anemometer at the lift where available).',
      'Suspend lifting and work at height when approved limits are exceeded.',
      'Secure loose materials, scaffolding sheeting and temporary structures.',
    ],
  },
  dust: {
    title: 'Dust storm',
    items: [
      'Monitor visibility and dust conditions.',
      'Implement safe-driving precautions (reduced speed, headlights, journey management).',
      'Stop activities when conditions become unsafe.',
      'Protect personnel from dust exposure (appropriate RPE and eye protection).',
      'Protect sensitive equipment, air intakes and open excavations.',
    ],
  },
  visibility: {
    title: 'Reduced visibility',
    items: [
      'Apply journey management controls; consider postponing non-essential travel.',
      'Use headlights, reduce speed and increase following distance.',
      'Use banksmen / spotters for vehicle and plant movements.',
      'Review lifting operations where the lift path cannot be seen clearly.',
    ],
  },
  rain: {
    title: 'Rain / heavy rainfall',
    items: [
      'Inspect access roads and site tracks before use.',
      'Check for slippery surfaces, walkways and stairs.',
      'Inspect electrical equipment and temporary installations for water ingress.',
      'Check excavations and bunds for water accumulation and wall stability.',
    ],
  },
  thunder: {
    title: 'Thunderstorm',
    items: [
      'Stop exposed outdoor activities when required by the lightning procedure.',
      'Move personnel to designated safe shelters.',
      'Follow the approved lightning safety procedure (including all-clear criteria).',
      'Suspend crane, work-at-height and elevated activities.',
    ],
  },
  lightning: {
    title: 'Lightning risk (indicative)',
    items: [
      'Treat as indicative only – this system has no lightning detection input.',
      'Maintain a lightning watch and confirm with an approved lightning detection service where available.',
      'Prepare shelters and communicate the lightning procedure to supervisors.',
    ],
  },
};

export interface Advisory {
  category: AlertCategory;
  level: Level;
  title: string;
  items: string[];
}

export function buildAdvisories(alerts: Alert[]): Advisory[] {
  return alerts
    .filter((a) => a.available && a.level > 0)
    .sort((a, b) => b.level - a.level)
    .map((a) => ({ category: a.category, level: a.level, ...PRECAUTIONS[a.category] }));
}

export const ADVISORY_DISCLAIMER =
  'Advisories are generic guidance generated automatically from model-derived weather data. They are subject to confirmation against the approved site procedures, client requirements and HSE limits, and do not replace on-site judgement, instrument readings or the permit-to-work system.';
