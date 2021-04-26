import { TextDecoder, TextEncoder } from "web-encoding";

export function fromUtf8ToArray(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function fromBufferToB64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function fromBufferToUtf8(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

export function fromB64ToArray(str: string): Uint8Array {
  return Buffer.from(str, "base64");
}
