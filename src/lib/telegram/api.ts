import fs from "node:fs";
import path from "node:path";

/** Cliente mínimo de la Bot API de Telegram. El token nunca aparece en errores ni registros. */
const API = "https://api.telegram.org";
const POLL_SECONDS = 30;
const REQUEST_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
const CAPTION_MAX = 1_024;
const MESSAGE_MAX = 4_000;
const ALBUM_MAX = 10;

export interface TelegramUser {
  id: number;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
  voice?: { file_id: string; duration: number; file_size?: number };
  audio?: { file_id: string; duration: number; file_size?: number };
}

export interface TelegramCallback {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
}

export interface Button {
  text: string;
  data: string;
}

interface Envelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export class TelegramApi {
  constructor(private readonly token: string) {}

  private async call<T>(method: string, body: Record<string, unknown> | FormData, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    const isForm = body instanceof FormData;
    let response: Response;
    try {
      response = await fetch(`${API}/bot${this.token}/${method}`, {
        method: "POST",
        headers: isForm ? undefined : { "Content-Type": "application/json" },
        body: isForm ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new Error(`Telegram no respondió (${method}): ${error instanceof Error ? error.name : "error de red"}`);
    }
    const data = (await response.json().catch(() => ({}))) as Envelope<T>;
    if (!data.ok) throw new Error(`Telegram rechazó ${method}: ${data.description || response.status}`);
    return data.result as T;
  }

  getUpdates(offset: number): Promise<TelegramUpdate[]> {
    return this.call(
      "getUpdates",
      { offset, timeout: POLL_SECONDS, allowed_updates: ["message", "callback_query"] },
      (POLL_SECONDS + 15) * 1000,
    );
  }

  async sendMessage(chatId: number, text: string, buttons?: Button[][]): Promise<TelegramMessage> {
    return this.call("sendMessage", {
      chat_id: chatId,
      text: text.slice(0, MESSAGE_MAX),
      reply_markup: buttons
        ? { inline_keyboard: buttons.map((row) => row.map((button) => ({ text: button.text, callback_data: button.data }))) }
        : undefined,
    });
  }

  async answerCallback(id: string, text?: string): Promise<void> {
    await this.call("answerCallbackQuery", { callback_query_id: id, text });
  }

  /** Quita los botones de un mensaje ya respondido. */
  async clearButtons(chatId: number, messageId: number): Promise<void> {
    await this.call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
  }

  async sendChatAction(chatId: number, action: "typing" | "upload_photo" | "upload_video"): Promise<void> {
    await this.call("sendChatAction", { chat_id: chatId, action });
  }

  /** Manda imágenes de a álbumes de hasta 10. */
  async sendPhotos(chatId: number, photos: Array<{ data: Buffer; caption: string }>): Promise<void> {
    for (let start = 0; start < photos.length; start += ALBUM_MAX) {
      const group = photos.slice(start, start + ALBUM_MAX);
      const form = new FormData();
      form.append("chat_id", String(chatId));
      const blob = (data: Buffer) => new Blob([new Uint8Array(data)], { type: "image/png" });
      // Un álbum necesita al menos dos fotos: una sola va como foto suelta.
      if (group.length === 1) {
        form.append("caption", group[0].caption.slice(0, CAPTION_MAX));
        form.append("photo", blob(group[0].data), "flyer.png");
        await this.call("sendPhoto", form, UPLOAD_TIMEOUT_MS);
        continue;
      }
      form.append(
        "media",
        JSON.stringify(group.map((photo, index) => ({ type: "photo", media: `attach://p${index}`, caption: photo.caption.slice(0, CAPTION_MAX) }))),
      );
      group.forEach((photo, index) => form.append(`p${index}`, blob(photo.data), `p${index}.png`));
      await this.call("sendMediaGroup", form, UPLOAD_TIMEOUT_MS);
    }
  }

  async sendVideo(chatId: number, file: string, caption: string): Promise<void> {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption.slice(0, CAPTION_MAX));
    form.append("supports_streaming", "true");
    form.append("video", new Blob([new Uint8Array(fs.readFileSync(file))], { type: "video/mp4" }), path.basename(file));
    await this.call("sendVideo", form, UPLOAD_TIMEOUT_MS);
  }

  /** Descarga un archivo que mandó el usuario (por ejemplo, un audio). */
  async download(fileId: string, maxBytes: number): Promise<Buffer> {
    const file = await this.call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
    if (!file.file_path) throw new Error("Telegram no devolvió el archivo.");
    if (file.file_size && file.file_size > maxBytes) throw new Error("El archivo es demasiado grande.");
    const response = await fetch(`${API}/file/bot${this.token}/${file.file_path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`No se pudo descargar el archivo de Telegram (${response.status}).`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > maxBytes) throw new Error("El archivo es demasiado grande.");
    return data;
  }
}
