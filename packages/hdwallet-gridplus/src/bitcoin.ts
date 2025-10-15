import { pointCompress } from "@bitcoinerlab/secp256k1";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bchAddr from "bchaddrjs";
import * as bech32 from "bech32";
import { decode as bs58Decode } from "bs58check";
import CryptoJS from "crypto-js";
import { Client, Constants } from "gridplus-sdk";

import { UTXO_NETWORK_PARAMS } from "./constants";
import { deriveAddressFromPubkey } from "./utils";

const scriptTypeToPurpose = (scriptType: core.BTCInputScriptType): number => {
  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress:
      return 44;
    case core.BTCInputScriptType.SpendP2SHWitness:
      return 49;
    case core.BTCInputScriptType.SpendWitness:
      return 84;
    default:
      return 44;
  }
};

const encodeDerInteger = (x: Buffer): Buffer => {
  if (x[0] & 0x80) {
    return Buffer.concat([Buffer.from([0x00]), x]);
  }
  return x;
};

const encodeDerSignature = (rBuf: Buffer, sBuf: Buffer, sigHashType: number): Buffer => {
  const rEncoded = encodeDerInteger(rBuf);
  const sEncoded = encodeDerInteger(sBuf);

  const derSignature = Buffer.concat([
    Buffer.from([0x30]),
    Buffer.from([rEncoded.length + sEncoded.length + 4]),
    Buffer.from([0x02]),
    Buffer.from([rEncoded.length]),
    rEncoded,
    Buffer.from([0x02]),
    Buffer.from([sEncoded.length]),
    sEncoded,
    Buffer.from([sigHashType]),
  ]);

  return derSignature;
};

export const btcGetAccountPaths = (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> => {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (!slip44) throw new Error(`Unsupported coin: ${msg.coin}`);

  const scriptTypes: core.BTCInputScriptType[] = (() => {
    if (msg.coin === "Dogecoin" || msg.coin === "BitcoinCash") {
      return [core.BTCInputScriptType.SpendAddress];
    } else {
      return [
        core.BTCInputScriptType.SpendAddress,
        core.BTCInputScriptType.SpendP2SHWitness,
        core.BTCInputScriptType.SpendWitness,
      ];
    }
  })();

  return scriptTypes.map((scriptType) => {
    const purpose = scriptTypeToPurpose(scriptType);
    return {
      coin: msg.coin,
      scriptType,
      addressNList: [0x80000000 + purpose, 0x80000000 + slip44, 0x80000000 + (msg.accountIdx || 0), 0, 0],
    };
  });
};

export async function btcGetAddress(client: Client, msg: core.BTCGetAddress): Promise<string | null> {
  // Get compressed public key from device (works for all UTXOs)
  // Using SECP256K1_PUB flag bypasses Lattice's address formatting,
  // which only supports Bitcoin/EVM chains/Solana
  const pubkeys = await client.getAddresses({
    startPath: msg.addressNList,
    n: 1,
    flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
  });

  if (!pubkeys || !pubkeys.length) {
    throw new Error("No public key returned from device");
  }

  // pubkeys[0] may be uncompressed (65 bytes) or compressed (33 bytes)
  const pubkeyBuffer = Buffer.isBuffer(pubkeys[0]) ? pubkeys[0] : Buffer.from(pubkeys[0], "hex");

  // Compress if needed (65 bytes = uncompressed, 33 bytes = already compressed)
  const pubkeyHex =
    pubkeyBuffer.length === 65
      ? Buffer.from(pointCompress(pubkeyBuffer, true)).toString("hex")
      : pubkeyBuffer.toString("hex");

  // Derive address client-side using the coin's network parameters
  const scriptType = msg.scriptType || core.BTCInputScriptType.SpendAddress;
  const address = deriveAddressFromPubkey(pubkeyHex, msg.coin, scriptType);

  return address;
}

export async function btcSignTx(client: Client, msg: core.BTCSignTx): Promise<core.BTCSignedTx | null> {
  // All UTXOs (Bitcoin, Dogecoin, Litecoin, Bitcoin Cash) use Bitcoin-compatible transaction formats.
  // The 'BTC' currency parameter is just SDK routing - the device signs Bitcoin-formatted transactions.
  // Address derivation already handles all coins via client-side derivation with proper network parameters.

  // Calculate fee: total inputs - total outputs
  const totalInputValue = msg.inputs.reduce((sum, input) => sum + parseInt(input.amount || "0"), 0);
  const totalOutputValue = msg.outputs.reduce((sum, output) => sum + parseInt(output.amount || "0"), 0);
  const fee = totalInputValue - totalOutputValue;

  // Find change output and its path
  const changeOutput = msg.outputs.find((o) => o.isChange);
  const changePath = changeOutput?.addressNList;

  // SDK requires changePath even when there's no change output
  // Use actual change path if available, otherwise use dummy path (first change address)
  // The dummy path satisfies SDK validation but won't be used since there's no change output
  const finalChangePath =
    changePath && changePath.length === 5
      ? changePath
      : [
          msg.inputs[0].addressNList[0], // purpose (44', 49', or 84')
          msg.inputs[0].addressNList[1], // coin type
          msg.inputs[0].addressNList[2], // account
          1, // change chain (1 = change, 0 = receive)
          0, // address index
        ];

  // Build base payload for GridPlus SDK
  const payload: {
    prevOuts: Array<{ txHash: string; value: number; index: number; signerPath: number[] }>;
    recipient: string;
    value: number;
    fee: number;
    changePath: number[];
  } = {
    prevOuts: msg.inputs.map((input) => ({
      txHash: input.txid,
      value: parseInt(input.amount || "0"),
      index: input.vout,
      signerPath: input.addressNList,
    })),
    recipient: msg.outputs[0]?.address || "",
    value: parseInt(msg.outputs[0]?.amount || "0"),
    fee: fee,
    changePath: finalChangePath,
  };

  if (msg.coin === "Bitcoin") {
    const signData = await client.sign({
      currency: "BTC",
      data: payload,
    });

    if (!signData || !signData.tx) {
      throw new Error("No signed transaction returned from device");
    }

    const signatures = signData.sigs ? signData.sigs.map((s: Buffer) => s.toString("hex")) : [];

    return {
      signatures,
      serializedTx: signData.tx,
    };
  } else {
    const network = UTXO_NETWORK_PARAMS[msg.coin];
    if (!network) {
      throw new Error(`Unsupported UTXO coin: ${msg.coin}`);
    }

    const tx = new bitcoin.Transaction();

    for (const input of msg.inputs) {
      const txHashBuffer = Buffer.from(input.txid, "hex").reverse();
      tx.addInput(txHashBuffer, input.vout);
    }

    for (let outputIdx = 0; outputIdx < msg.outputs.length; outputIdx++) {
      const output = msg.outputs[outputIdx];
      let address: string;

      if (output.address) {
        address = output.address;
      } else if (output.addressNList) {
        // Derive address for change output
        const pubkey = await client.getAddresses({
          startPath: output.addressNList,
          n: 1,
          flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
        });

        if (!pubkey || !pubkey.length) {
          throw new Error(`No public key for output`);
        }

        const pubkeyBuffer = Buffer.isBuffer(pubkey[0]) ? pubkey[0] : Buffer.from(pubkey[0], "hex");

        const pubkeyHex =
          pubkeyBuffer.length === 65
            ? Buffer.from(pointCompress(pubkeyBuffer, true)).toString("hex")
            : pubkeyBuffer.toString("hex");

        const scriptType =
          (output.scriptType as unknown as core.BTCInputScriptType) || core.BTCInputScriptType.SpendAddress;
        address = deriveAddressFromPubkey(pubkeyHex, msg.coin, scriptType);
      } else {
        throw new Error("Output must have either address or addressNList");
      }

      const { scriptPubKey: outputScriptPubKey } = (() => {
        // Native SegWit (bech32): ltc1 for Litecoin, bc1 for Bitcoin
        if (address.startsWith("ltc1") || address.startsWith("bc1")) {
          const decoded = bech32.decode(address);
          const hash160 = Buffer.from(bech32.fromWords(decoded.words.slice(1)));

          const scriptPubKey = bitcoin.script.compile([bitcoin.opcodes.OP_0, hash160]);
          return { scriptPubKey };
        }

        // Bitcoin Cash CashAddr format: bitcoincash: prefix or q for mainnet
        if (address.startsWith("bitcoincash:") || address.startsWith("q")) {
          const legacyAddress = bchAddr.toLegacyAddress(address);
          const decoded = bs58Decode(legacyAddress);
          const versionByte = decoded[0];
          const hash160 = decoded.slice(1);

          // Check if P2SH (Bitcoin Cash uses 0x05 for P2SH)
          if (versionByte === network.scriptHash) {
            const scriptPubKey = bitcoin.script.compile([
              bitcoin.opcodes.OP_HASH160,
              hash160,
              bitcoin.opcodes.OP_EQUAL,
            ]);
            return { scriptPubKey };
          }

          // P2PKH
          const scriptPubKey = bitcoin.script.compile([
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,
            hash160,
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG,
          ]);
          return { scriptPubKey };
        }

        // Other Base58 addresses (P2PKH or P2SH)
        const decoded = bs58Decode(address);
        const versionByte = decoded[0];
        const hash160 = decoded.slice(1);

        // Check if P2SH by comparing version byte with network's scriptHash
        if (versionByte === network.scriptHash) {
          const scriptPubKey = bitcoin.script.compile([bitcoin.opcodes.OP_HASH160, hash160, bitcoin.opcodes.OP_EQUAL]);
          return { scriptPubKey };
        }

        // P2PKH (Legacy)
        const scriptPubKey = bitcoin.script.compile([
          bitcoin.opcodes.OP_DUP,
          bitcoin.opcodes.OP_HASH160,
          hash160,
          bitcoin.opcodes.OP_EQUALVERIFY,
          bitcoin.opcodes.OP_CHECKSIG,
        ]);
        return { scriptPubKey };
      })();

      tx.addOutput(outputScriptPubKey, BigInt(output.amount));
    }

    const signatures: string[] = [];

    for (let i = 0; i < msg.inputs.length; i++) {
      const input = msg.inputs[i];

      if (!input.hex) {
        throw new Error(`Input ${i} missing hex field (raw previous transaction)`);
      }

      const prevTx = bitcoin.Transaction.fromHex(input.hex);
      const prevOutput = prevTx.outs[input.vout];
      const scriptPubKey = prevOutput.script;

      // Detect input type from scriptPubKey
      // P2WPKH (SegWit): 0x00 0x14 <20-byte-hash>
      const isSegwit = scriptPubKey.length === 22 && scriptPubKey[0] === 0x00 && scriptPubKey[1] === 0x14;

      // Build signature preimage based on input type
      let signaturePreimage: Buffer;
      const hashType =
        msg.coin === "BitcoinCash"
          ? bitcoin.Transaction.SIGHASH_ALL | 0x40 // SIGHASH_FORKID for Bitcoin Cash
          : bitcoin.Transaction.SIGHASH_ALL;

      // BIP143 signing for SegWit inputs (all coins) and Bitcoin Cash P2PKH
      // See: https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki
      const useBIP143 = isSegwit || msg.coin === "BitcoinCash";

      if (useBIP143) {
        // BIP143 signing (used for SegWit and Bitcoin Cash)
        const hashPrevouts = CryptoJS.SHA256(
          CryptoJS.SHA256(
            CryptoJS.lib.WordArray.create(
              Buffer.concat(
                msg.inputs.map((inp) =>
                  Buffer.concat([Buffer.from(inp.txid, "hex").reverse(), Buffer.from([inp.vout, 0, 0, 0])])
                )
              )
            )
          )
        );

        const hashSequence = CryptoJS.SHA256(
          CryptoJS.SHA256(
            CryptoJS.lib.WordArray.create(Buffer.concat(msg.inputs.map(() => Buffer.from([0xff, 0xff, 0xff, 0xff]))))
          )
        );

        const hashOutputs = CryptoJS.SHA256(
          CryptoJS.SHA256(
            CryptoJS.lib.WordArray.create(
              Buffer.concat(
                tx.outs.map((out) => {
                  const valueBuffer = Buffer.alloc(8);
                  const value = typeof out.value === "bigint" ? out.value : BigInt(out.value);
                  valueBuffer.writeBigUInt64LE(value);
                  return Buffer.concat([valueBuffer, Buffer.from([out.script.length]), out.script]);
                })
              )
            )
          )
        );

        // scriptCode depends on input type
        let scriptCode: Buffer;
        if (isSegwit) {
          // P2WPKH: Build scriptCode from hash extracted from witness program
          scriptCode = Buffer.from(
            bitcoin.script.compile([
              bitcoin.opcodes.OP_DUP,
              bitcoin.opcodes.OP_HASH160,
              scriptPubKey.slice(2), // Remove OP_0 and length byte to get hash
              bitcoin.opcodes.OP_EQUALVERIFY,
              bitcoin.opcodes.OP_CHECKSIG,
            ])
          );
        } else {
          // P2PKH (Bitcoin Cash): scriptCode IS the scriptPubKey
          scriptCode = Buffer.from(scriptPubKey);
        }

        if (!input.amount) {
          throw new Error(`Input ${i} missing amount field (required for BIP143 signing)`);
        }
        const valueBuffer = Buffer.alloc(8);
        const value = BigInt(input.amount);
        valueBuffer.writeBigUInt64LE(value);

        signaturePreimage = Buffer.concat([
          Buffer.from([tx.version, 0, 0, 0]),
          Buffer.from(hashPrevouts.toString(CryptoJS.enc.Hex), "hex"),
          Buffer.from(hashSequence.toString(CryptoJS.enc.Hex), "hex"),
          Buffer.from(input.txid, "hex").reverse(),
          Buffer.from([input.vout, 0, 0, 0]),
          Buffer.from([scriptCode.length]),
          scriptCode,
          valueBuffer,
          Buffer.from([0xff, 0xff, 0xff, 0xff]), // sequence
          Buffer.from(hashOutputs.toString(CryptoJS.enc.Hex), "hex"),
          Buffer.from([tx.locktime, 0, 0, 0]),
          Buffer.from([hashType, 0, 0, 0]),
        ]);
      } else {
        // Legacy signing
        const txTmp = tx.clone();

        // Remove OP_CODESEPARATOR from scriptPubKey (Bitcoin standard)
        const decompiled = bitcoin.script.decompile(scriptPubKey);
        if (!decompiled) {
          throw new Error(`Failed to decompile scriptPubKey for input ${i}`);
        }
        const scriptPubKeyForSigning = bitcoin.script.compile(
          decompiled.filter((x) => x !== bitcoin.opcodes.OP_CODESEPARATOR)
        );

        // For SIGHASH_ALL: blank all input scripts except the one being signed
        txTmp.ins.forEach((txInput, idx) => {
          txInput.script = idx === i ? scriptPubKeyForSigning : Buffer.alloc(0);
        });

        // Serialize transaction + append hashType (4 bytes)
        const txBuffer = txTmp.toBuffer();
        const hashTypeBuffer = Buffer.alloc(4);
        hashTypeBuffer.writeUInt32LE(hashType, 0);
        signaturePreimage = Buffer.concat([txBuffer, hashTypeBuffer]);
      }

      // UTXOs require double SHA256 for transaction signatures.
      // Strategy: Hash once ourselves, then let device hash again (SHA256 + SHA256 = double SHA256)
      // This avoids using hashType.NONE which causes "Invalid Request" errors.
      const hash1 = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(signaturePreimage));
      const singleHashedBuffer = Buffer.from(hash1.toString(CryptoJS.enc.Hex), "hex");

      const signData = {
        data: {
          payload: singleHashedBuffer,
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.SHA256, // Device will hash again → double SHA256
          encodingType: Constants.SIGNING.ENCODINGS.NONE,
          signerPath: input.addressNList,
        },
      };

      let signedResult;
      try {
        signedResult = await client.sign(signData);
      } catch (error) {
        throw new Error(`Device signing failed for input ${i}: ${(error as Error).message}`);
      }

      if (!signedResult?.sig) {
        throw new Error(`No signature returned from device for input ${i}`);
      }

      const { r, s } = signedResult.sig;
      const rBuf = Buffer.isBuffer(r) ? r : Buffer.from(r);
      const sBuf = Buffer.isBuffer(s) ? s : Buffer.from(s);

      // Use the same hashType that was used for the signature preimage
      const sigHashType =
        msg.coin === "BitcoinCash"
          ? bitcoin.Transaction.SIGHASH_ALL | 0x40 // SIGHASH_FORKID for Bitcoin Cash
          : bitcoin.Transaction.SIGHASH_ALL;
      const derSig = encodeDerSignature(rBuf, sBuf, sigHashType);
      signatures.push(derSig.toString("hex"));
    }

    // Reconstruct a clean transaction from scratch with all signatures
    // This ensures proper scriptSig encoding using bitcoinjs-lib
    const finalTx = new bitcoin.Transaction();
    finalTx.version = tx.version;
    finalTx.locktime = tx.locktime;

    // Add inputs with proper scriptSigs
    for (let i = 0; i < msg.inputs.length; i++) {
      const input = msg.inputs[i];
      const txHashBuffer = Buffer.from(input.txid, "hex").reverse();
      finalTx.addInput(txHashBuffer, input.vout);

      // Get the signature we collected earlier
      const derSig = Buffer.from(signatures[i], "hex");

      // Get pubkey for this input
      const pubkey = await client.getAddresses({
        startPath: input.addressNList,
        n: 1,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      });

      if (!pubkey || !pubkey.length) {
        throw new Error(`No public key for input ${i}`);
      }

      const pubkeyBuffer = Buffer.isBuffer(pubkey[0]) ? pubkey[0] : Buffer.from(pubkey[0], "hex");
      const compressedPubkey =
        pubkeyBuffer.length === 65 ? Buffer.from(pointCompress(pubkeyBuffer, true)) : pubkeyBuffer;

      // Detect input type to determine if we need SegWit or legacy encoding
      const prevTx = bitcoin.Transaction.fromHex(input.hex);
      const prevOutput = prevTx.outs[input.vout];
      const isSegwit =
        prevOutput.script.length === 22 && prevOutput.script[0] === 0x00 && prevOutput.script[1] === 0x14;

      if (isSegwit) {
        // SegWit: empty scriptSig, signature + pubkey in witness
        finalTx.ins[i].script = Buffer.alloc(0);
        finalTx.ins[i].witness = [derSig, compressedPubkey];
      } else {
        // Legacy: signature + pubkey in scriptSig
        const scriptSig = bitcoin.script.compile([derSig, compressedPubkey]);
        finalTx.ins[i].script = scriptSig;
      }
    }

    // Add outputs - handle both address and addressNList
    for (let outputIdx = 0; outputIdx < msg.outputs.length; outputIdx++) {
      const output = msg.outputs[outputIdx];
      let address: string;

      if (output.address) {
        // Output already has address
        address = output.address;
      } else if (output.addressNList) {
        // Derive address from addressNList (for change outputs)
        const pubkey = await client.getAddresses({
          startPath: output.addressNList,
          n: 1,
          flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
        });

        if (!pubkey || !pubkey.length) {
          throw new Error(`No public key for output`);
        }

        const pubkeyBuffer = Buffer.isBuffer(pubkey[0]) ? pubkey[0] : Buffer.from(pubkey[0], "hex");

        const pubkeyHex =
          pubkeyBuffer.length === 65
            ? Buffer.from(pointCompress(pubkeyBuffer, true)).toString("hex")
            : pubkeyBuffer.toString("hex");

        const scriptType =
          (output.scriptType as unknown as core.BTCInputScriptType) || core.BTCInputScriptType.SpendAddress;
        address = deriveAddressFromPubkey(pubkeyHex, msg.coin, scriptType);
      } else {
        throw new Error("Output must have either address or addressNList");
      }

      const { scriptPubKey: finalScriptPubKey } = (() => {
        // Native SegWit (bech32): ltc1 for Litecoin, bc1 for Bitcoin
        if (address.startsWith("ltc1") || address.startsWith("bc1")) {
          const decoded = bech32.decode(address);
          const hash160 = Buffer.from(bech32.fromWords(decoded.words.slice(1)));

          const scriptPubKey = bitcoin.script.compile([bitcoin.opcodes.OP_0, hash160]);
          return { scriptPubKey };
        }

        // Bitcoin Cash CashAddr format: bitcoincash: prefix or q for mainnet
        if (address.startsWith("bitcoincash:") || address.startsWith("q")) {
          const legacyAddress = bchAddr.toLegacyAddress(address);
          const decoded = bs58Decode(legacyAddress);
          const versionByte = decoded[0];
          const hash160 = decoded.slice(1);

          // Check if P2SH (Bitcoin Cash uses 0x05 for P2SH)
          if (versionByte === network.scriptHash) {
            const scriptPubKey = bitcoin.script.compile([
              bitcoin.opcodes.OP_HASH160,
              hash160,
              bitcoin.opcodes.OP_EQUAL,
            ]);
            return { scriptPubKey };
          }

          // P2PKH
          const scriptPubKey = bitcoin.script.compile([
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,
            hash160,
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG,
          ]);
          return { scriptPubKey };
        }

        // Other Base58 addresses (P2PKH or P2SH)
        const decoded = bs58Decode(address);
        const versionByte = decoded[0];
        const hash160 = decoded.slice(1);

        // Check if P2SH by comparing version byte with network's scriptHash
        if (versionByte === network.scriptHash) {
          const scriptPubKey = bitcoin.script.compile([bitcoin.opcodes.OP_HASH160, hash160, bitcoin.opcodes.OP_EQUAL]);
          return { scriptPubKey };
        }

        // P2PKH (Legacy)
        const scriptPubKey = bitcoin.script.compile([
          bitcoin.opcodes.OP_DUP,
          bitcoin.opcodes.OP_HASH160,
          hash160,
          bitcoin.opcodes.OP_EQUALVERIFY,
          bitcoin.opcodes.OP_CHECKSIG,
        ]);
        return { scriptPubKey };
      })();

      finalTx.addOutput(finalScriptPubKey, BigInt(output.amount));
    }

    const serializedTx = finalTx.toHex();

    return {
      signatures,
      serializedTx,
    };
  }
}

export const btcNextAccountPath = (msg: core.BTCAccountPath): core.BTCAccountPath | undefined => {
  const newAddressNList = [...msg.addressNList];
  newAddressNList[2] += 1;

  return {
    ...msg,
    addressNList: newAddressNList,
  };
};
