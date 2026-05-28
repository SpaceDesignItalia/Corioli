import axios from "axios";
import { appendClientFileAccessToken } from "../utils/configureClientApi";

export interface SupportAttachmentDto {
  url: string;
  mimeType: string;
  name: string;
  size: number | null;
}

export interface SupportChatMessageDto {
  id: string;
  senderType: "client" | "operator";
  body: string;
  createdAt: string;
  operatorId: string | null;
  operatorName: string | null;
  attachment: SupportAttachmentDto | null;
}

const baseUrl = () => import.meta.env.VITE_API_URL as string;

export function resolveAttachmentUrl(url: string): string {
  let resolved: string;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    resolved = url;
  } else {
    const api = baseUrl().replace(/\/$/, "");
    const origin = api.replace(/\/api\/v1$/i, "");
    const path = url.startsWith("/") ? url : `/${url}`;
    resolved = `${origin}${path}`;
  }
  return appendClientFileAccessToken(resolved);
}

function clientPath(clientId: string, suffix: string) {
  return `${baseUrl()}/support/client/${encodeURIComponent(clientId)}${suffix}`;
}

export async function fetchSupportMessages(
  clientId: string,
  since?: string,
  markRead = !since,
): Promise<{ conversationId: string | null; messages: SupportChatMessageDto[]; unreadCount: number }> {
  const { data } = await axios.get<{
    conversationId: string | null;
    messages: SupportChatMessageDto[];
    unreadCount: number;
  }>(clientPath(clientId, "/messages"), {
    params: {
      ...(since ? { since } : {}),
      markRead: markRead ? "true" : "false",
    },
  });
  return {
    conversationId: data.conversationId,
    messages: data.messages,
    unreadCount: data.unreadCount ?? 0,
  };
}

export async function fetchClientUnreadCount(clientId: string): Promise<number> {
  const { data } = await axios.get<{ unreadCount: number }>(
    clientPath(clientId, "/unread-count"),
  );
  return data.unreadCount ?? 0;
}

export async function sendSupportMessage(
  clientId: string,
  options: { text?: string; file?: File },
): Promise<{ message: SupportChatMessageDto; conversationId: string }> {
  const form = new FormData();
  if (options.text?.trim()) form.append("text", options.text.trim());
  if (options.file) form.append("file", options.file);

  const { data } = await axios.post<{
    message: SupportChatMessageDto;
    conversationId: string;
  }>(clientPath(clientId, "/messages"), form);
  return { message: data.message, conversationId: data.conversationId };
}

export async function deleteSupportConversation(clientId: string): Promise<void> {
  await axios.delete(clientPath(clientId, "/conversation"));
}

export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function mapToUiMessage(msg: SupportChatMessageDto) {
  const attachments = msg.attachment
    ? [
        {
          type: "file" as const,
          name: msg.attachment.name,
          url: resolveAttachmentUrl(msg.attachment.url),
          mimeType: msg.attachment.mimeType,
          size: msg.attachment.size ?? undefined,
        },
      ]
    : undefined;

  return {
    id: msg.id,
    role: msg.senderType === "client" ? ("user" as const) : ("operator" as const),
    text: msg.body || undefined,
    attachments,
    time: formatChatTime(msg.createdAt),
    createdAt: msg.createdAt,
  };
}
