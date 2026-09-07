import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Ambulance, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createServiceRequest,
  fullName,
  searchPatients,
  type ServiceRequestFormValues,
} from "@/lib/fhir";

export const Route = createFileRoute("/ambulance/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Ambulance overdracht — HAP" },
      {
        name: "description",
        content:
          "Registreer een overdracht van zorg vanuit de ambulance als ServiceRequest op de FHIR R4 server.",
      },
      { property: "og:title", content: "Ambulance overdracht — HAP" },
      {
        property: "og:description",
        content:
          "Registreer een overdracht van zorg vanuit de ambulance als ServiceRequest op de FHIR R4 server.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AmbulanceHandoverPage,
});

const EMPTY: ServiceRequestFormValues = {
  patientId: "",
  reasonText: "",
  patientInstruction: "",
  occurrenceDateTime: "",
};

type Errors = Partial<Record<keyof ServiceRequestFormValues, string>>;

function validate(values: ServiceRequestFormValues): Errors {
  const errors: Errors = {};
  if (!values.patientId) errors.patientId = "Selecteer een patient";
  if (!values.reasonText.trim()) errors.reasonText = "Hulpvraag is verplicht";
  else if (values.reasonText.trim().length > 500)
    errors.reasonText = "Hulpvraag mag maximaal 500 tekens bevatten";
  if (values.patientInstruction.trim().length > 1000)
    errors.patientInstruction = "Advies mag maximaal 1000 tekens bevatten";
  if (values.occurrenceDateTime && Number.isNaN(new Date(values.occurrenceDateTime).getTime()))
    errors.occurrenceDateTime = "Ongeldige datum/tijd";
  return errors;
}

function AmbulanceHandoverPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<ServiceRequestFormValues>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const patientsQuery = useQuery({
    queryKey: ["patients", ""],
    queryFn: () => searchPatients(""),
    retry: false,
  });

  const patients = useMemo(
    () =>
      (patientsQuery.data ?? [])
        .filter((p) => !!p.id)
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [patientsQuery.data],
  );

  const send = useMutation({
    mutationFn: (v: ServiceRequestFormValues) => createServiceRequest(v),
    onSuccess: () => {
      toast.success("Overdracht verzonden naar de FHIR server");
      const pid = values.patientId;
      setValues(EMPTY);
      setErrors({});
      if (pid) navigate({ to: "/ambulance/patient/$id", params: { id: pid } });
    },
    onError: (error: Error) => toast.error(error.message || "Verzenden is mislukt"),
  });

  const set = <K extends keyof ServiceRequestFormValues>(key: K, value: ServiceRequestFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Ambulance className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Overdracht van zorg vanuit ambulance</h1>
            <p className="text-sm text-muted-foreground">
              Opgeslagen als ServiceRequest op de FHIR R4 server
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Terug naar HAP
          </Link>
        </Button>

        {patientsQuery.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Kon patienten niet laden</AlertTitle>
            <AlertDescription>
              {(patientsQuery.error as Error).message}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-fit"
                onClick={() => patientsQuery.refetch()}
              >
                Opnieuw proberen
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <form
          className="space-y-5 rounded-xl border border-border bg-card p-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = validate(values);
            setErrors(next);
            if (Object.keys(next).length === 0) send.mutate(values);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="patient">Patient</Label>
            {patientsQuery.isPending ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={values.patientId}
                onValueChange={(v) => set("patientId", v)}
                disabled={patientsQuery.isError}
              >
                <SelectTrigger id="patient">
                  <SelectValue placeholder="Selecteer een patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id!}>
                      {fullName(p)}
                      {p.birthDate ? ` — ${p.birthDate}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.patientId && <p className="text-xs text-destructive">{errors.patientId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reasonText">Hulpvraag</Label>
            <Textarea
              id="reasonText"
              value={values.reasonText}
              onChange={(e) => set("reasonText", e.target.value)}
              placeholder="Bijv. Patient is vanuit acute ambulancezorg voor verdere zorg doorverwezen naar de huisartsenspoedpost."
              rows={3}
              maxLength={500}
            />
            {errors.reasonText && <p className="text-xs text-destructive">{errors.reasonText}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="patientInstruction">Advies aan patient vanuit de ambulance</Label>
            <Textarea
              id="patientInstruction"
              value={values.patientInstruction}
              onChange={(e) => set("patientInstruction", e.target.value)}
              placeholder="Bijv. Huisarts nog inlichten."
              rows={3}
              maxLength={1000}
            />
            {errors.patientInstruction && (
              <p className="text-xs text-destructive">{errors.patientInstruction}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurrenceDateTime">Datum/tijd overdracht (optioneel)</Label>
            <Input
              id="occurrenceDateTime"
              type="datetime-local"
              value={values.occurrenceDateTime}
              onChange={(e) => set("occurrenceDateTime", e.target.value)}
            />
            {errors.occurrenceDateTime && (
              <p className="text-xs text-destructive">{errors.occurrenceDateTime}</p>
            )}
          </div>

          <Button type="submit" disabled={send.isPending || patientsQuery.isPending}>
            <Send className="size-4" />
            {send.isPending ? "Verzenden..." : "Verzend overdracht"}
          </Button>
        </form>
      </section>
    </main>
  );
}
