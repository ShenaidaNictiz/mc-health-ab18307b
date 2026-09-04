import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Gender, PatientFormValues } from "@/lib/fhir";

const GENDERS: Gender[] = ["male", "female", "other", "unknown"];

const EMPTY: PatientFormValues = { given: "", family: "", gender: "unknown", birthDate: "" };

type Errors = Partial<Record<keyof PatientFormValues, string>>;

function validate(values: PatientFormValues): Errors {
  const errors: Errors = {};
  if (!values.given.trim()) errors.given = "First name is required";
  if (!values.family.trim()) errors.family = "Last name is required";
  if (!GENDERS.includes(values.gender)) errors.gender = "Select a gender";
  if (!values.birthDate) errors.birthDate = "Date of birth is required";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate))
    errors.birthDate = "Use the format YYYY-MM-DD";
  else if (new Date(values.birthDate) > new Date())
    errors.birthDate = "Date of birth cannot be in the future";
  return errors;
}

export function PatientForm({
  open,
  mode,
  initialValues,
  submitting,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: PatientFormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: PatientFormValues) => void;
}) {
  const [values, setValues] = useState<PatientFormValues>(initialValues ?? EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? EMPTY);
      setErrors({});
    }
  }, [open, initialValues]);

  const set = <K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New patient" : "Edit patient"}</DialogTitle>
          <DialogDescription>
            Saved directly to your FHIR server as a Patient record.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = validate(values);
            setErrors(next);
            if (Object.keys(next).length === 0) onSubmit(values);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="given">Given name(s)</Label>
              <Input
                id="given"
                value={values.given}
                onChange={(e) => set("given", e.target.value)}
                placeholder="Jane Marie"
              />
              {errors.given && <p className="text-xs text-destructive">{errors.given}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="family">Family name</Label>
              <Input
                id="family"
                value={values.family}
                onChange={(e) => set("family", e.target.value)}
                placeholder="Doe"
              />
              {errors.family && <p className="text-xs text-destructive">{errors.family}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={values.gender} onValueChange={(v) => set("gender", v as Gender)}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g} className="capitalize">
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.gender && <p className="text-xs text-destructive">{errors.gender}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Date of birth</Label>
            <Input
              id="birthDate"
              type="date"
              value={values.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
            {errors.birthDate && <p className="text-xs text-destructive">{errors.birthDate}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : mode === "create" ? "Create patient" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
