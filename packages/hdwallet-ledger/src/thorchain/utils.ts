import { fromByteArray } from "base64-js";

export const getSignature = (signatureArray: any) => {
  // Check Type Length Value encoding
  if (signatureArray.length < 64) {
    throw new Error("Invalid Signature: Too short");
  }
  if (signatureArray[0] !== 0x30) {
    throw new Error("Invalid Ledger Signature TLV encoding: expected first byte 0x30");
  }
  if (signatureArray[1] + 2 !== signatureArray.length) {
    throw new Error("Invalid Signature: signature length does not match TLV");
  }
  if (signatureArray[2] !== 0x02) {
    throw new Error("Invalid Ledger Signature TLV encoding: expected length type 0x02");
  }

  // r signature
  const rLength = signatureArray[3];
  let rSignature = signatureArray.slice(4, rLength + 4);

  // Drop leading zero on some 'r' signatures that are 33 bytes.
  if (rSignature.length === 33 && rSignature[0] === 0) {
    rSignature = rSignature.slice(1, 33);
  } else if (rSignature.length === 33) {
    throw new Error('Invalid signature: "r" too long');
  }

  // add leading zero's to pad to 32 bytes
  while (rSignature.length < 32) {
    rSignature.unshift(0);
  }

  // s signature
  if (signatureArray[rLength + 4] !== 0x02) {
    throw new Error("Invalid Ledger Signature TLV encoding: expected length type 0x02");
  }

  const sLength = signatureArray[rLength + 5];

  if (4 + rLength + 2 + sLength !== signatureArray.length) {
    throw new Error("Invalid Ledger Signature: TLV byte lengths do not match message length");
  }

  let sSignature = signatureArray.slice(rLength + 6, signatureArray.length);

  // Drop leading zero on 's' signatures that are 33 bytes. This shouldn't occur since ledger signs using "Small s" math. But just to be sure...
  if (sSignature.length === 33 && sSignature[0] === 0) {
    sSignature = sSignature.slice(1, 33);
  } else if (sSignature.length === 33) {
    throw new Error('Invalid signature: "s" too long');
  }

  // add leading zero's to pad to 32 bytes
  while (sSignature.length < 32) {
    sSignature.unshift(0);
  }

  if (rSignature.length !== 32 || sSignature.length !== 32) {
    throw new Error("Invalid signatures: must be 32 bytes each");
  }

  return fromByteArray(Buffer.concat([rSignature, sSignature]));
};
