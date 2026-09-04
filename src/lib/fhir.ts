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
