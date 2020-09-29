export function fromUtf8ToArray(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "utf8"));
}

export function fromBufferToB64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function fromBufferToUtf8(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("utf8");
}

export function fromB64ToArray(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

export function toArrayBuffer(value: string | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (typeof value === "string") {
    return fromUtf8ToArray(value).buffer;
  } else if ("buffer" in value) {
    return value.buffer;
  }
  return value;
}
