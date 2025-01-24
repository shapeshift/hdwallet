import { Revocable } from "..";

export interface Node extends Partial<Revocable> {
  getPublicKey(): Promise<Uint8Array>;
  derive(index: number): Promise<this>;
  sign(message: Uint8Array): Promise<Uint8Array>;
}
