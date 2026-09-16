/** Images attached to chat messages: shrunk in the browser so a phone photo costs kilobytes, not megabytes. */

export interface ImageAttachment {
  type: "file";
  mediaType: string;
  filename?: string;
  /** A data URL; the API moves the bytes to storage on receipt. */
  url: string;
}

export const MAX_ATTACHMENTS = 3;
const MAX_EDGE_PX = 1536;
const JPEG_QUALITY = 0.85;

/** Decodes the image, fits it inside MAX_EDGE_PX and re-encodes it as JPEG (PNG when it has transparency to keep). */
export async function toImageAttachment(file: Blob, filename?: string): Promise<ImageAttachment> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be attached");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot resize images");
    context.drawImage(bitmap, 0, 0, width, height);
    const keepAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
    const mediaType = keepAlpha ? "image/png" : "image/jpeg";
    const url = canvas.toDataURL(mediaType, JPEG_QUALITY);
    return { type: "file", mediaType, filename, url };
  } finally {
    bitmap.close();
  }
}

/** The image bytes behind one of this user's generations, for attaching it to a chat message. */
export async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl, { credentials: "include" });
  if (!response.ok) throw new Error("Could not load the image");
  return response.blob();
}

/** Hand-off from the gallery to the chat: the image to attach to the next message. */
export const CHAT_HANDOFF_KEY = "switchboard.chat.attach";

export interface ChatHandoff {
  generationId: string;
  imageUrl: string;
  prompt: string;
}

export function setChatHandoff(handoff: ChatHandoff): void {
  try { window.sessionStorage.setItem(CHAT_HANDOFF_KEY, JSON.stringify(handoff)); } catch { /* storage unavailable: the chat opens empty */ }
}

export function generationIdFromImageUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const path = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.href).pathname;
    const match = path.match(/\/generations\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/image$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function takeChatHandoff(): ChatHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(CHAT_HANDOFF_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(CHAT_HANDOFF_KEY);
    return JSON.parse(raw) as ChatHandoff;
  } catch {
    return null;
  }
}
