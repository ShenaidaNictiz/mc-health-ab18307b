export type Gender = "male" | "female" | "other" | "unknown";

export interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  name?: { given?: string[]; family?: string }[];
  gender?: Gender;
  birthDate?: string;
  meta?: { versionId?: string };
}

export interface PatientFormValues {
  given: string;
  family: string;
  gender: Gender;
  birthDate: string;
}

export function fullName(patient: FhirPatient): string {
  const n = patient.name?.[0];
  const given = n?.given?.filter(Boolean).join(" ") ?? "";
  const family = n?.family ?? "";
  return [given, family].filter(Boolean).join(" ") || "(no name)";
}

export function toFormValues(patient: FhirPatient): PatientFormValues {
  const n = patient.name?.[0];
  return {
    given: n?.given?.filter(Boolean).join(" ") ?? "",
    family: n?.family ?? "",
    gender: patient.gender ?? "unknown",
    birthDate: patient.birthDate ?? "",
  };
}

export function toResource(values: PatientFormValues, existing?: FhirPatient): FhirPatient {
  return {
    ...(existing ?? {}),
    resourceType: "Patient",
    name: [
      {
        given: values.given.trim().split(/\s+/).filter(Boolean),
        family: values.family.trim(),
      },
    ],
    gender: values.gender,
    birthDate: values.birthDate,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/fhir/${path}`, {
    ...init,
    headers: { Accept: "application/fhir+json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const p = parsed as
      | { error?: string; issue?: { diagnostics?: string; details?: { text?: string } }[] }
      | null;
    const detail =
      p?.error ?? p?.issue?.[0]?.diagnostics ?? p?.issue?.[0]?.details?.text ?? text.slice(0, 200);
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return parsed as T;
}

interface Bundle {
  entry?: { resource?: FhirPatient }[];
}

export async function searchPatients(name: string): Promise<FhirPatient[]> {
  const params = new URLSearchParams({ _count: "50", _sort: "-_lastUpdated" });
  if (name.trim()) params.set("name", name.trim());
  const bundle = await request<Bundle>(`Patient?${params.toString()}`);
  return (bundle.entry ?? [])
    .map((e) => e.resource)
    .filter((r): r is FhirPatient => r?.resourceType === "Patient");
}

export function createPatient(values: PatientFormValues) {
  return request<FhirPatient>("Patient", {
    method: "POST",
    headers: { "Content-Type": "application/fhir+json" },
    body: JSON.stringify(toResource(values)),
  });
}

export function updatePatient(existing: FhirPatient, values: PatientFormValues) {
  return request<FhirPatient>(`Patient/${existing.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/fhir+json" },
    body: JSON.stringify(toResource(values, existing)),
  });
}

/* ---------- Patient details, vitals, conditions, medications ---------- */

interface Coding {
  system?: string;
  code?: string;
  display?: string;
}
interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code?: CodeableConcept;
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: { value?: number; unit?: string };
  component?: { code?: CodeableConcept; valueQuantity?: { value?: number; unit?: string } }[];
}

export interface FhirCondition {
  resourceType: "Condition";
  id?: string;
  code?: CodeableConcept;
  onsetDateTime?: string;
  onsetPeriod?: { start?: string };
  recordedDate?: string;
  clinicalStatus?: CodeableConcept;
}

export interface FhirMedication {
  resourceType: "Medication";
  id?: string;
  code?: CodeableConcept;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  authoredOn?: string;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: { display?: string; reference?: string };
  contained?: { resourceType?: string; id?: string; code?: CodeableConcept }[];
  /** Resolved display name, filled in by getMedications(). */
  medicationDisplay?: string;
}

interface AnyBundle<T> {
  entry?: { resource?: T }[];
}

function bundleEntries<T extends { resourceType?: string }>(
  bundle: AnyBundle<T>,
  type: string,
): T[] {
  return (bundle.entry ?? []).map((e) => e.resource).filter((r): r is T => r?.resourceType === type);
}

export function getPatient(id: string) {
  return request<FhirPatient>(`Patient/${id}`);
}

export const VITAL_CODES = {
  heartRate: "8867-4",
  temperature: "8310-5",
  respiratoryRate: "9279-1",
  oxygenSaturation: "59408-5",
  height: "8302-2",
  weight: "29463-7",
  bmi: "39156-5",
  systolic: "8480-6",
  diastolic: "8462-4",
} as const;

export async function getVitals(id: string): Promise<FhirObservation[]> {
  const codes = "8867-4,8310-5,9279-1,59408-5,8302-2,29463-7,39156-5,55284-4";
  const params = new URLSearchParams({
    subject: `Patient/${id}`,
    code: codes,
    _count: "500",
    _sort: "date",
  });
  const bundle = await request<AnyBundle<FhirObservation>>(`Observation?${params.toString()}`);
  return bundleEntries(bundle, "Observation");
}

export async function getConditions(id: string): Promise<FhirCondition[]> {
  const bundle = await request<AnyBundle<FhirCondition>>(
    `Condition?patient=${encodeURIComponent(id)}&_count=200`,
  );
  return bundleEntries(bundle, "Condition");
}

export async function getMedications(id: string): Promise<FhirMedicationRequest[]> {
  const bundle = await request<AnyBundle<FhirMedicationRequest>>(
    `MedicationRequest?patient=${encodeURIComponent(id)}&_count=200`,
  );
  return bundleEntries(bundle, "MedicationRequest");
}

export function conceptText(c?: CodeableConcept): string {
  return c?.text ?? c?.coding?.[0]?.display ?? c?.coding?.[0]?.code ?? "—";
}

export function observationDate(o: FhirObservation): string {
  return o.effectiveDateTime ?? o.issued ?? "";
}

export interface VitalPoint {
  date: string;
  value: number;
  value2?: number | undefined;
  unit?: string | undefined;
}

/** Extract time series for a LOINC code, checking both the observation code and its components. */
export function seriesFor(observations: FhirObservation[], code: string): VitalPoint[] {
  const points: VitalPoint[] = [];
  for (const o of observations) {
    const date = observationDate(o);
    if (!date) continue;
    const matchesTop = o.code?.coding?.some((c) => c.code === code);
    if (matchesTop && typeof o.valueQuantity?.value === "number") {
      points.push({ date, value: o.valueQuantity.value, unit: o.valueQuantity.unit });
      continue;
    }
    const comp = o.component?.find((c) => c.code?.coding?.some((cc) => cc.code === code));
    if (comp && typeof comp.valueQuantity?.value === "number") {
      points.push({ date, value: comp.valueQuantity.value, unit: comp.valueQuantity.unit });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Blood pressure: pair systolic and diastolic readings by timestamp. */
export function bloodPressureSeries(observations: FhirObservation[]): VitalPoint[] {
  const sys = seriesFor(observations, VITAL_CODES.systolic);
  const dia = seriesFor(observations, VITAL_CODES.diastolic);
  const byDate = new Map<string, VitalPoint>();
  for (const s of sys) byDate.set(s.date, { date: s.date, value: s.value, unit: s.unit });
  for (const d of dia) {
    const existing = byDate.get(d.date);
    if (existing) existing.value2 = d.value;
    else byDate.set(d.date, { date: d.date, value: NaN, value2: d.value, unit: d.unit });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
