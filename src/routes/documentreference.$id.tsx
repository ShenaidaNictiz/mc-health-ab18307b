import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { conceptText, getDocumentReference } from "@/lib/fhir";

export const Route = createFileRoute("/documentreference/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Document uit de ambulanceoverdracht" },
      {
        name: "description",
        content: "Bekijk het meegestuurde document van de ambulanceoverdracht als PDF.",
      },
      { property: "og:title", content: "Document uit de ambulanceoverdracht" },
      {
        property: "og:description",
        content: "Bekijk het meegestuurde document van de ambulanceoverdracht als PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentReferencePage,
});

function DocumentReferencePage() {
  const { id } = Route.useParams();
  const docQuery = useQuery({
    queryKey: ["document-reference", id],
    queryFn: () => getDocumentReference(id),
    retry: false,
  });

  const attachment = docQuery.data?.content?.find((c) => c.attachment?.data || c.attachment?.url)
    ?.attachment;
  const title =
    attachment?.title ??
    docQuery.data?.description ??
    conceptText(docQuery.data?.type) ??
    "Document";
  const contentType = attachment?.contentType ?? "application/pdf";
  const src = attachment?.data ? `data:${contentType};base64,${attachment.data}` : attachment?.url;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FileText className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">DocumentReference/{id}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="size-4" />
            Terug
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        {docQuery.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Document kon niet worden geladen</AlertTitle>
            <AlertDescription>{(docQuery.error as Error).message}</AlertDescription>
          </Alert>
        )}
        {docQuery.isPending && <Skeleton className="h-[70vh] w-full rounded-xl" />}
        {!docQuery.isPending && !docQuery.isError && !src && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Geen documentinhoud</AlertTitle>
            <AlertDescription>
              Dit document bevat geen bijlage die getoond kan worden.
            </AlertDescription>
          </Alert>
        )}
        {src && (
          <>
            <object
              data={src}
              type={contentType}
              className="h-[75vh] w-full rounded-xl border border-border bg-card"
            >
              <p className="p-4 text-sm">
                Uw browser kan dit document niet tonen.{" "}
                <a href={src} download className="text-primary underline underline-offset-4">
                  Download het document
                </a>
                .
              </p>
            </object>
            <div>
              <Button variant="outline" asChild>
                <a href={src} download={`${title}.pdf`}>
                  Download PDF
                </a>
              </Button>
            </div>
          </>
        )}
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="underline underline-offset-4">
            Terug naar patiëntenlijst
          </Link>
        </p>
      </div>
    </main>
  );
}
