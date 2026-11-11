interface NarrativeRecord {
  status: string;
  actual?: string;
  steps?: {name: string; status: string; actual?: string; error?: string}[];
}
export function caseActual(record: NarrativeRecord, observed?: string): string;
export function reportActual(record: NarrativeRecord): string;
