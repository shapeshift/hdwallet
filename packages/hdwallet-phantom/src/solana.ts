import * as core from "@shapeshiftoss/hdwallet-core";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { PhantomSolanaProvider } from "./types";

export type SolanaAccount = {
  publicKey: PublicKey;
};

function toTransactionInstructions(instructions: core.SolanaTxInstruction[]): TransactionInstruction[] {
  return instructions.map(
    (instruction) =>
      new TransactionInstruction({
        keys: instruction.keys.map((key) => Object.assign(key, { pubkey: new PublicKey(key.pubkey) })),
        programId: new PublicKey(instruction.programId),
        data: instruction.data,
      })
  );
}

function buildTransaction(msg: core.SolanaSignTx, address: string): VersionedTransaction {
  const instructions = toTransactionInstructions(msg.instructions ?? []);

  const value = Number(msg.value);
  if (!isNaN(value) && value > 0 && msg.to) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(address),
        toPubkey: new PublicKey(msg.to),
        lamports: value,
      })
    );
  }

  if (msg.computeUnitLimit !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: msg.computeUnitLimit }));
  }

  if (msg.computeUnitPrice !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: msg.computeUnitPrice }));
  }

  const message = new TransactionMessage({
    payerKey: new PublicKey(address),
    instructions,
    recentBlockhash: msg.blockHash,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export async function solanaSignTx(
  msg: core.SolanaSignTx,
  provider: PhantomSolanaProvider,
  address: string
): Promise<core.SolanaSignedTx | null> {
  const transaction = buildTransaction(msg, address);
  const signedTransaction = await provider.signTransaction(transaction);
  return {
    serialized: Buffer.from(signedTransaction.serialize()).toString("base64"),
    signatures: signedTransaction.signatures.map((signature) => Buffer.from(signature).toString("base64")),
  };
}

export async function solanaSendTx(
  msg: core.SolanaSignTx,
  provider: PhantomSolanaProvider,
  address: string
): Promise<core.SolanaTxSignature | null> {
  const transaction = buildTransaction(msg, address);
  const { signature } = await provider.signAndSendTransaction(transaction);
  return { signature };
}
