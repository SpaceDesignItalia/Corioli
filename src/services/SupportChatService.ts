import axios from "axios";
import { Doctor } from "../types/Storage";

export interface SupportChatMessageDto {
  id: string;
  senderType: "client" | "operator";
  body: string;
  createdAt: string;
  operatorId: string | null;
  operatorName: string | null;
}

const baseUrl = () => import.meta.env.VITE_API_URL as string;

function doctorParams(doctor: Doctor) {
  return {
    nome: doctor.nome,
    cognome: doctor.cognome,
    email: doctor.email,
    numero_telefono: doctor.telefono ?? "",
    specializzazione: doctor.specializzazione ?? "",
  };
}

export async function fetchSupportMessages(
  doctor: Doctor,
  since?: string,
): Promise<SupportChatMessageDto[]> {
  const { data } = await axios.get<{
    conversationId: string;
    messages: SupportChatMessageDto[];
  }>(`${baseUrl()}/support/client/${encodeURIComponent(doctor.id)}/messages`, {
    params: { ...doctorParams(doctor), ...(since ? { since } : {}) },
  });
  return data.messages;
}

export async function sendSupportMessage(
  doctor: Doctor,
  text: string,
): Promise<SupportChatMessageDto> {
  const { data } = await axios.post<{ message: SupportChatMessageDto }>(
    `${baseUrl()}/support/client/${encodeURIComponent(doctor.id)}/messages`,
    { text, ...doctorParams(doctor) },
  );
  return data.message;
}

export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function mapToUiMessage(msg: SupportChatMessageDto) {
  return {
    id: msg.id,
    role: msg.senderType === "client" ? ("user" as const) : ("operator" as const),
    text: msg.body,
    time: formatChatTime(msg.createdAt),
    createdAt: msg.createdAt,
  };
}
