import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Ambulance, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  conceptText,
  documentReferenceLinks,
  fullName,
  getPatient,
  getServiceRequests,
} from "@/lib/fhir";


export const Route = createFileRoute("/ambulance/patient/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Overdracht van zorg vanuit ambulance" },
      {
        name: "description",
        content:
          "Ambulance handover page showing the patient's demographics read live from the FHIR R4 server.",
      },
      { property: "og:title", content: "Overdracht van zorg vanuit ambulance" },
      {
        property: "og:description",
        content:
          "Ambulance handover page showing the patient's demographics read live from the FHIR R4 server.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AmbulanceHandoverPage,
});

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function AmbulanceHandoverPage() {
  const { id } = Route.useParams();
  const patientQuery = useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatient(id),
    retry: false,
  });
  const patient = patientQuery.data;

  const serviceQuery = useQuery({
    queryKey: ["service-requests", id],
    queryFn: () => getServiceRequests(id),
    retry: false,
  });
  const serviceRequests = serviceQuery.data ?? [];
  const reasons = serviceRequests.flatMap((sr) => sr.reasonCode ?? []);
  const instructions = serviceRequests
    .map((sr) => sr.patientInstruction)
    .filter((v): v is string => !!v && v.trim().length > 0);
  const documents = documentReferenceLinks(serviceRequests);


  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Ambulance className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Overdracht van zorg vanuit ambulance
              </h1>
              <p className="text-sm text-muted-foreground">
                {patientQuery.isPending ? "Loading patient…" : patient ? fullName(patient) : "Patient"}
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link to="/patient/$id" params={{ id }}>
              <ArrowLeft className="size-4" />
              Back to patient
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Demographics</h2>
          {patientQuery.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Could not load patient</AlertTitle>
              <AlertDescription>{(patientQuery.error as Error).message}</AlertDescription>
            </Alert>
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
                <div className="mt-1">
                  <Badge variant="secondary" className="capitalize">
                    {patient.gender ?? "unknown"}
                  </Badge>
                </div>
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
      </div>
    </main>
  );
}
