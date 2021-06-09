import * as bnbSdk from "bnb-javascript-sdk-nobroadcast";
import * as crypto from "crypto";
import tinyecc from "tiny-secp256k1";

export function decodeBnbTx(txBytes: Buffer, chainId: string) {
  const txDecoded = bnbSdk.amino.decoder.unMarshalBinaryLengthPrefixed(txBytes, {
    aminoPrefix: "f0625dee",
    msgs: [
      {
        aminoPrefix: "2a2c87fa",
        inputs: [{ address: Buffer.alloc(0), coins: [{ denom: "", amount: 0 }] }],
        outputs: [{ address: Buffer.alloc(0), coins: [{ denom: "", amount: 0 }] }],
      },
    ],
    signatures: [
      {
        pubKey: Buffer.alloc(0),
        signature: Buffer.alloc(0),
        accountNumber: 0,
        sequence: 0,
      },
    ],
    memo: "",
    source: 0,
    data: Buffer.alloc(0),
  }).val;

  if (txDecoded.data !== null) throw new Error("bad data length");
  if (txDecoded.msgs.length !== 1) throw new Error("bad msgs length");
  if (txDecoded.signatures.length !== 1) throw new Error("bad signatures length");

  const signBytes = JSON.stringify({
    account_number: String(txDecoded.signatures[0].accountNumber),
    chain_id: chainId,
    data: null,
    memo: txDecoded.memo,
    msgs: [
      {
        inputs: txDecoded.msgs[0].inputs.map((x: any) => ({
          address: bnbSdk.crypto.encodeAddress(x.address, "bnb"),
          coins: x.coins.map((y: any) => ({
            amount: Number(y.amount),
            denom: y.denom,
          })),
        })),
        outputs: txDecoded.msgs[0].outputs.map((x: any) => ({
          address: bnbSdk.crypto.encodeAddress(x.address, "bnb"),
          coins: x.coins.map((y: any) => ({
            amount: Number(y.amount),
            denom: y.denom,
          })),
        })),
      },
    ],
    sequence: String(txDecoded.signatures[0].sequence),
    source: String(txDecoded.source),
  });

  const signBytesHash = crypto.createHash("sha256").update(Buffer.from(signBytes, "utf8")).digest();

  const pubKeyAmino = Buffer.from(txDecoded.signatures[0].pubKey);
  if (pubKeyAmino.readUInt32BE(0) !== 0xeb5ae987) throw new Error("bad pubkey aminoPrefix");
  if (pubKeyAmino.readUInt8(4) !== 33) throw new Error("bad pubKey length");
  const pubKey = pubKeyAmino.slice(5);

  const signature = txDecoded.signatures[0].signature;
  return { signBytes, signBytesHash, pubKey, signature };
}

export function validateBnbTx(txBytes: Buffer, chainId: string) {
  const { signBytesHash, pubKey, signature } = decodeBnbTx(txBytes, chainId);
  return tinyecc.verify(signBytesHash, pubKey, signature);
}
