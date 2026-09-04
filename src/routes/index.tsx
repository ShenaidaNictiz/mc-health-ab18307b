import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Pencil, Plus, Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PatientForm } from "@/components/PatientForm";
import {
  createPatient,
  fullName,
  searchPatients,
  toFormValues,
  updatePatient,
  type FhirPatient,
  type PatientFormValues,
} from "@/lib/fhir";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Patient Registry — FHIR R4 Patient Management" },
      {
        name: "description",
        content:
          "Search, create and update patient records stored on your FHIR R4 server, with live reads and writes through the FHIR REST API.",
      },
      { property: "og:title", content: "Patient Registry — FHIR R4 Patient Management" },
      {
        property: "og:description",
        content:
          "Search, create and update patient records stored on your FHIR R4 server, with live reads and writes through the FHIR REST API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PatientsPage,
});

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function genderBadgeClass(gender?: string) {
  switch (gender) {
    case "male":
      return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900";
    case "female":
      return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900";
    default:
      return "";
  }
}

function PatientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<FhirPatient | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const patientsQuery = useQuery({
    queryKey: ["patients", debounced],
    queryFn: () => searchPatients(debounced),
    retry: false,
  });

  const initialValues = useMemo(
    () => (editing ? toFormValues(editing) : undefined),
    [editing],
  );

  const save = useMutation({
    mutationFn: (values: PatientFormValues) =>
      editing ? updatePatient(editing, values) : createPatient(values),
    onSuccess: async () => {
      toast.success(editing ? "Patient updated" : "Patient created");
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not save the patient"),
  });

  const patients = patientsQuery.data ?? [];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Patient Registry</h1>
              <p className="text-sm text-muted-foreground">Live records from your FHIR R4 server</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            New patient
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients by name..."
            className="pl-9"
            aria-label="Search patients by name"
          />
        </div>

        {patientsQuery.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load patients</AlertTitle>
            <AlertDescription>
              {(patientsQuery.error as Error).message}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-fit"
                onClick={() => patientsQuery.refetch()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Date of birth</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patientsQuery.isPending &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!patientsQuery.isPending && !patientsQuery.isError && patients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              )}

              {!patientsQuery.isPending &&
                patients.map((patient) => (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (patient.id) navigate({ to: "/patient/$id", params: { id: patient.id } });
                    }}
                  >
                    <TableCell className="font-medium">
                      <span className="underline-offset-4 hover:underline">
                        {fullName(patient)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("capitalize", genderBadgeClass(patient.gender))}
                      >
                        {patient.gender ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(patient.birthDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(patient);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {patientsQuery.isFetching && !patientsQuery.isPending && (
          <p className="text-sm text-muted-foreground">Updating results…</p>
        )}
      </section>

      <PatientForm
        open={formOpen}
        mode={editing ? "edit" : "create"}
        initialValues={initialValues}
        submitting={save.isPending}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => save.mutate(values)}
      />
    </main>
  );
}
