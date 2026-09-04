import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BarChart3, TableIcon, Stethoscope } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bloodPressureSeries,
  conceptText,
  fullName,
  getConditions,
  getMedications,
  getPatient,
  getVitals,
  seriesFor,
  VITAL_CODES,
  type VitalPoint,
} from "@/lib/fhir";

export const Route = createFileRoute("/patient/$id")({
  head: () => ({
    meta: [
      { title: "Patient Details — Vitals, Conditions & Medications" },
      {
        name: "description",
        content:
          "Patient demographics with time-series vital sign charts, conditions and current medications read live from the FHIR R4 server.",
      },
      { property: "og:title", content: "Patient Details — Vitals, Conditions & Medications" },
      {
        property: "og:description",
        content:
          "Patient demographics with time-series vital sign charts, conditions and current medications read live from the FHIR R4 server.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PatientDetailPage,
});

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

interface VitalDef {
  key: string;
  label: string;
  points: VitalPoint[];
  dual?: boolean;
}

function VitalChart({ vital }: { vital: VitalDef }) {
  const data = vital.points.map((p) => ({
    ...p,
    label: formatDate(p.date),
  }));
  const unit = vital.points.find((p) => p.unit)?.unit ?? "";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{vital.label}</h3>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {vital.dual && <Legend wrapperStyle={{ fontSize: 12 }} />}
            <Line
              type="monotone"
              dataKey="value"
              name={vital.dual ? "Systolic" : vital.label}
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
            {vital.dual && (
              <Line
                type="monotone"
                dataKey="value2"
                name="Diastolic"
                stroke="var(--color-destructive)"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VitalTable({ vital }: { vital: VitalDef }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{vital.label}</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {vital.dual ? (
              <>
                <TableHead>Systolic</TableHead>
                <TableHead>Diastolic</TableHead>
              </>
            ) : (
              <TableHead>Value</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vital.points.map((p, i) => (
            <TableRow key={i}>
              <TableCell>{formatDateTime(p.date)}</TableCell>
              <TableCell>
                {Number.isNaN(p.value) ? "—" : p.value} {p.unit ?? ""}
              </TableCell>
              {vital.dual && (
                <TableCell>
                  {p.value2 ?? "—"} {p.unit ?? ""}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PatientDetailPage() {
  const { id } = Route.useParams();
  const [view, setView] = useState<"chart" | "table">("chart");

  const patientQuery = useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatient(id),
    retry: false,
  });
  const vitalsQuery = useQuery({
    queryKey: ["vitals", id],
    queryFn: () => getVitals(id),
    retry: false,
  });
  const conditionsQuery = useQuery({
    queryKey: ["conditions", id],
    queryFn: () => getConditions(id),
    retry: false,
  });
  const medsQuery = useQuery({
    queryKey: ["medications", id],
    queryFn: () => getMedications(id),
    retry: false,
  });

  const obs = vitalsQuery.data ?? [];
  const vitals: VitalDef[] = [
    { key: "hr", label: "Heart rate", points: seriesFor(obs, VITAL_CODES.heartRate) },
    { key: "bp", label: "Blood pressure", points: bloodPressureSeries(obs), dual: true },
    { key: "temp", label: "Temperature", points: seriesFor(obs, VITAL_CODES.temperature) },
    { key: "rr", label: "Respiratory rate", points: seriesFor(obs, VITAL_CODES.respiratoryRate) },
    { key: "spo2", label: "Oxygen saturation", points: seriesFor(obs, VITAL_CODES.oxygenSaturation) },
    { key: "height", label: "Height", points: seriesFor(obs, VITAL_CODES.height) },
    { key: "weight", label: "Weight", points: seriesFor(obs, VITAL_CODES.weight) },
    { key: "bmi", label: "BMI", points: seriesFor(obs, VITAL_CODES.bmi) },
  ].filter((v) => v.points.length > 0);

  const patient = patientQuery.data;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {patientQuery.isPending ? "Loading patient…" : patient ? fullName(patient) : "Patient"}
              </h1>
              <p className="text-sm text-muted-foreground">Patient record from your FHIR R4 server</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back to list
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Demographics</h2>
          {patientQuery.isError && (
            <ErrorBox
              title="Could not load patient"
              message={(patientQuery.error as Error).message}
            />
          )}
          {patientQuery.isPending && <Skeleton className="h-24 w-full rounded-xl" />}
          {patient && (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Full name</p>
                <p className="mt-1 font-medium">{fullName(patient)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gender</p>
                <p className="mt-1">
                  <Badge variant="secondary" className="capitalize">
                    {patient.gender ?? "unknown"}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Date of birth
                </p>
                <p className="mt-1 font-medium">{formatDate(patient.birthDate)}</p>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Vital signs</h2>
            <div className="inline-flex rounded-lg border border-border p-1">
              <Button
                size="sm"
                variant={view === "chart" ? "default" : "ghost"}
                onClick={() => setView("chart")}
              >
                <BarChart3 className="size-4" />
                Charts
              </Button>
              <Button
                size="sm"
                variant={view === "table" ? "default" : "ghost"}
                onClick={() => setView("table")}
              >
                <TableIcon className="size-4" />
                Table
              </Button>
            </div>
          </div>

          {vitalsQuery.isError && (
            <ErrorBox title="Could not load vitals" message={(vitalsQuery.error as Error).message} />
          )}
          {vitalsQuery.isPending && (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          )}
          {!vitalsQuery.isPending && !vitalsQuery.isError && vitals.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
              No vital sign readings found for this patient.
            </p>
          )}
          {vitals.length > 0 && (
            <div className={view === "chart" ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
              {vitals.map((v) =>
                view === "chart" ? (
                  <VitalChart key={v.key} vital={v} />
                ) : (
                  <VitalTable key={v.key} vital={v} />
                ),
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Conditions</h2>
          {conditionsQuery.isError && (
            <ErrorBox
              title="Could not load conditions"
              message={(conditionsQuery.error as Error).message}
            />
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Condition</TableHead>
                  <TableHead>Onset date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conditionsQuery.isPending && (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                  </TableRow>
                )}
                {!conditionsQuery.isPending && (conditionsQuery.data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      No conditions recorded.
                    </TableCell>
                  </TableRow>
                )}
                {conditionsQuery.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{conceptText(c.code)}</TableCell>
                    <TableCell>
                      {formatDate(c.onsetDateTime ?? c.onsetPeriod?.start ?? c.recordedDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Medications</h2>
          {medsQuery.isError && (
            <ErrorBox
              title="Could not load medications"
              message={(medsQuery.error as Error).message}
            />
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medsQuery.isPending && (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                  </TableRow>
                )}
                {!medsQuery.isPending && (medsQuery.data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      No medications recorded.
                    </TableCell>
                  </TableRow>
                )}
                {medsQuery.data?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.medicationCodeableConcept
                        ? conceptText(m.medicationCodeableConcept)
                        : (m.medicationReference?.display ?? "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {m.status ?? "unknown"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </main>
  );
}
