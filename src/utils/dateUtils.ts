/**
 * Calcola l'età in anni a partire dalla data di nascita (stringa ISO o YYYY-MM-DD).
 * Restituisce null se la data non è valida.
 */
export function calculateAge(dataNascita: string): number | null {
  if (!dataNascita || typeof dataNascita !== "string") return null;
  const birth = new Date(dataNascita);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}
