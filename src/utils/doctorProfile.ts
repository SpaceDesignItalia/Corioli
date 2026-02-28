import { Doctor } from "../types/Storage";

type DoctorProfileLike = Pick<
  Doctor,
  "nome" | "cognome" | "email" | "telefono" | "specializzazione"
>;

const REQUIRED_PROFILE_FIELDS: Array<{
  key: keyof Doctor;
  label: string;
}> = [
  { key: "nome", label: "Nome" },
  { key: "cognome", label: "Cognome" },
  { key: "email", label: "Email" },
  { key: "telefono", label: "Telefono" },
  { key: "specializzazione", label: "Specializzazione" },
];

export function getMissingDoctorProfileFields(
  doctor: DoctorProfileLike | null,
): string[] {
  if (!doctor) return REQUIRED_PROFILE_FIELDS.map((f) => f.label);
  return REQUIRED_PROFILE_FIELDS.filter(({ key }) => {
    const value = doctor[key];
    return !String(value ?? "").trim();
  }).map((f) => f.label);
}

export function isDoctorProfileComplete(doctor: DoctorProfileLike | null): boolean {
  return getMissingDoctorProfileFields(doctor).length === 0;
}

export function getDoctorProfileIncompleteMessage(
  doctor: DoctorProfileLike | null,
): string {
  const missing = getMissingDoctorProfileFields(doctor);
  if (missing.length === 0) return "";
  return `Completa prima il profilo dottore in Impostazioni. Campi mancanti: ${missing.join(", ")}.`;
}
