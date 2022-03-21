import * as core from "@shapeshiftoss/hdwallet-core";
import * as bnbSdk from "bnb-javascript-sdk-nobroadcast";
import CryptoJS from "crypto-js";
import TinySecP256K1 from "tiny-secp256k1";

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

  const signBytesHash = CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(signBytes)).toString();

  const pubKeyAmino = Buffer.from(txDecoded.signatures[0].pubKey);
  if (pubKeyAmino.readUInt32BE(0) !== 0xeb5ae987) throw new Error("bad pubkey aminoPrefix");
  if (pubKeyAmino.readUInt8(4) !== 33) throw new Error("bad pubKey length");
  const pubKey = pubKeyAmino.slice(5);

  const signature = txDecoded.signatures[0].signature;
  return { signBytes, signBytesHash, pubKey, signature };
}

export function validateBnbTx(txBytes: Buffer, chainId: string) {
  const { signBytesHash, pubKey, signature } = decodeBnbTx(txBytes, chainId);
  return TinySecP256K1.verify(Buffer.from(signBytesHash, "hex"), pubKey, signature);
}

export function encodeBnbTx(unsignedTx: core.BinanceTx, publicKey: Buffer, signature: Buffer) {
  const { account_number, chain_id, sequence, source } = unsignedTx;
  const msg = unsignedTx.msgs[0];

  const amountToInt = (x: any) => Number(x);
  const msgNormalizer = (x: any) => ({
    address: bnbSdk.crypto.decodeAddress(x.address),
    coins: x.coins.map((y: any) => ({
      // In particular, these keys are backwards because we can't have nice things.
      denom: y.denom,
      amount: amountToInt(y.amount),
    })),
  });
  const baseMsg = {
    inputs: msg.inputs.map(msgNormalizer),
    outputs: msg.outputs.map(msgNormalizer),
    aminoPrefix: "2A2C87FA",
  };

  const tx = new bnbSdk.Transaction(
    Object.assign({}, unsignedTx, {
      chainId: chain_id,
      accountNumber: Number(account_number),
      source: Number(source ?? 0),
      sequence: Number(sequence),
      // A bug in the binance SDK makes this field required, even though it shouldn't be.
      baseMsg: { getMsg: () => baseMsg, getBaseMsg: () => baseMsg, getSignMsg: () => baseMsg },
    })
  );

  const ecPubKey = bnbSdk.crypto.getPublicKey(Buffer.from(publicKey).toString("hex"));
  tx.addSignature(ecPubKey, signature);

  const serializedTx = Buffer.from(tx.serialize(), "hex");
  if (!validateBnbTx(serializedTx, chain_id)) throw new Error("serialized tx did not validate");
  return serializedTx;
}
