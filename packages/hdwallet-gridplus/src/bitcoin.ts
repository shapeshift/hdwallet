import { pointCompress } from "@bitcoinerlab/secp256k1";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bchAddr from "bchaddrjs";
import * as bech32 from "bech32";
import { decode as bs58Decode } from "bs58check";
import CryptoJS from "crypto-js";
import { Client, Constants } from "gridplus-sdk";

export function createPayment(pubkey: Buffer, network: bitcoin.Network, scriptType: core.BTCScriptType) {
  switch (scriptType) {
    case "p2sh":
      return bitcoin.payments.p2sh({ pubkey, network });
    case "p2pkh":
      return bitcoin.payments.p2pkh({ pubkey, network });
    case "p2wpkh":
    case "bech32":
      return bitcoin.payments.p2wpkh({ pubkey, network });
    case "p2sh-p2wpkh":
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
        network,
      });
    default:
      throw new Error(`Unsupported script type: ${scriptType}`);
  }
}

export function deriveAddressFromPubkey(
  pubkey: Buffer,
  coin: string,
  scriptType: core.BTCScriptType = core.BTCInputScriptType.SpendAddress
): string | undefined {
  const network = core.getNetwork(coin, scriptType);
  return createPayment(pubkey, network, scriptType).address;
}

const u32le = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
};

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

const getPublicKey = async (client: Client, addressNList: core.BIP32Path) => {
  // returned as secp256k1 public key
  const pubkey = (
    await client.getAddresses({ startPath: addressNList, n: 1, flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB })
  )[0];

  if (!pubkey) throw new Error("No public key returned from device");
  if (!(pubkey instanceof Buffer)) throw new Error("Invalid public key returned from device");

  return pubkey;
};

export async function btcGetAddress(client: Client, msg: core.BTCGetAddress): Promise<string | null> {
  const pubkey = await getPublicKey(client, msg.addressNList);

  const address = deriveAddressFromPubkey(pubkey, msg.coin, msg.scriptType);
  if (!address) return null;

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

  /** I WANT ARBITRARY OUTPUT BUILD */

  // Find the spend output (first non-change output)
  // This ensures we don't accidentally use a change output as recipient
  const spendOutput = msg.outputs.find((o) => !o.isChange) || msg.outputs[0];

  if (!spendOutput.amount) {
    throw new Error("missing amount for spend output");
  }

  // Determine spend address and value
  let toAddress: string;
  if (spendOutput.address) {
    // Output already has address
    toAddress = spendOutput.address;
  } else if (spendOutput.addressNList) {
    const address = await btcGetAddress(client, {
      addressNList: spendOutput.addressNList,
      coin: msg.coin,
      scriptType: spendOutput.scriptType as any,
    });
    if (!address) throw new Error("No public key for spend output");

    toAddress = address;
  } else {
    throw new Error("Spend output must have either address or addressNList");
  }

  // Using parseInt instead of BigInt because GridPlus SDK payload requires `value: number`
  // This is safe for Bitcoin amounts: max UTXO is 21M BTC (2.1 trillion satoshis) which is
  // well under JavaScript's MAX_SAFE_INTEGER (9,007,199,254,740,991). SDK's internal
  // writeUInt64LE converts to string for hex encoding, supporting the full 64-bit range.
  const toValue = parseInt(spendOutput.amount, 10);
  if (isNaN(toValue)) {
    throw new Error(`Invalid amount for spend output: ${spendOutput.amount}`);
  }

  /** I WANT ARBITRARY OUTPUT BUILD END */

  if (msg.coin === "Bitcoin") {
    const signData = await client.sign({
      currency: "BTC",
      data: {
        prevOuts: msg.inputs.map((input) => ({
          txHash: input.txid,
          value: parseInt(input.amount || "0", 10),
          index: input.vout,
          signerPath: input.addressNList,
        })),
        recipient: toAddress,
        value: toValue,
        fee: fee,
        changePath: finalChangePath,
      },
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
    const psbt = new bitcoin.Psbt({
      network: core.getNetwork(msg.coin, core.BTCOutputScriptType.PayToMultisig),
      forkCoin: msg.coin.toLowerCase() === "bitcoincash" ? "bch" : "none",
    });

    psbt.setVersion(msg.version ?? 1);
    msg.locktime && psbt.setLocktime(msg.locktime);

    for (const input of msg.inputs) {
      if (!input.hex) throw new Error("Invalid input (missing hex)");

      const pubkey = await getPublicKey(client, input.addressNList);
      const network = core.getNetwork(msg.coin, input.scriptType);

      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        nonWitnessUtxo: Buffer.from(input.hex, "hex"),
        redeemScript: createPayment(pubkey, network, input.scriptType)?.redeem?.output,
      });
    }

    for (const output of msg.outputs) {
      if (!output.amount) throw new Error("Invalid output (missing amount)");

      const address = await (async () => {
        if (!output.address && !output.addressNList) {
          throw new Error("Invalid output (missing address or addressNList)");
        }

        const addr =
          output.address ??
          (await btcGetAddress(client, {
            addressNList: output.addressNList,
            coin: msg.coin,
            scriptType: output.scriptType as any,
          }));

        if (!addr) throw new Error("No public key for spend output");

        return msg.coin.toLowerCase() === "bitcoincash" ? bchAddr.toLegacyAddress(addr) : addr;
      })();

      psbt.addOutput({ address, value: BigInt(output.amount) });
    }

    if (msg.opReturnData) {
      const data = Buffer.from(msg.opReturnData, "utf-8");
      const script = bitcoin.payments.embed({ data: [data] }).output;
      if (!script) throw new Error("unable to build OP_RETURN script");
      // OP_RETURN_DATA outputs always have a value of 0
      psbt.addOutput({ script, value: BigInt(0) });
    }

    for (const input of msg.inputs) {
      // get sighash 

      const { sig } = await client.sign({
        data: {
          payload: "",
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.NONE,
          encodingType: Constants.SIGNING.ENCODINGS.NONE,
          signerPath: input.addressNList,
        },
      });
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

      // Detect input type:
      // - Segwit Native (P2WPKH): 0x00 0x14 <20-byte-hash> (22 bytes)
      // - Segwit (P2SH-P2WPKH): OP_HASH160 <20-byte-hash> OP_EQUAL (23 bytes), detected via BIP49 path
      // - Legacy (P2PKH): OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG (25 bytes)
      const isSegwitNative = scriptPubKey.length === 22 && scriptPubKey[0] === 0x00 && scriptPubKey[1] === 0x14;

      // Detect Segwit (wrapped SegWit) from BIP49 derivation path (m/49'/...)
      const purpose = input.addressNList[0] & ~0x80000000; // Remove hardening bit
      const isSegwit = purpose === 49;

      const isAnySegwit = isSegwitNative || isSegwit;

      // Build signature preimage based on input type
      let signaturePreimage: Buffer;
      const hashType =
        msg.coin === "BitcoinCash"
          ? bitcoin.Transaction.SIGHASH_ALL | 0x40 // SIGHASH_FORKID for Bitcoin Cash
          : bitcoin.Transaction.SIGHASH_ALL;

      // BIP143 signing for SegWit inputs (Segwit Native + Segwit) and Bitcoin Cash P2PKH
      // See: https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki
      const useBIP143 = isAnySegwit || msg.coin === "BitcoinCash";

      if (useBIP143) {
        // BIP143 signing (used for SegWit and Bitcoin Cash)
        const hashPrevouts = CryptoJS.SHA256(
          CryptoJS.SHA256(
            CryptoJS.lib.WordArray.create(
              Buffer.concat(
                msg.inputs.map((inp) => Buffer.concat([Buffer.from(inp.txid, "hex").reverse(), u32le(inp.vout)]))
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
        if (isSegwitNative) {
          // Segwit Native (P2WPKH): Build scriptCode from hash extracted from witness program
          scriptCode = Buffer.from(
            bitcoin.script.compile([
              bitcoin.opcodes.OP_DUP,
              bitcoin.opcodes.OP_HASH160,
              scriptPubKey.slice(2), // Remove OP_0 and length byte to get hash
              bitcoin.opcodes.OP_EQUALVERIFY,
              bitcoin.opcodes.OP_CHECKSIG,
            ])
          );
        } else if (isSegwit) {
          // Segwit (P2SH-P2WPKH): Build scriptCode from pubkey hash (same format as Segwit Native)
          // Need to derive pubkey hash from the input's public key
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

          // Hash160 = RIPEMD160(SHA256(pubkey))
          const pubkeyHash = bitcoin.crypto.hash160(compressedPubkey);

          scriptCode = Buffer.from(
            bitcoin.script.compile([
              bitcoin.opcodes.OP_DUP,
              bitcoin.opcodes.OP_HASH160,
              pubkeyHash,
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
          u32le(tx.version),
          Buffer.from(hashPrevouts.toString(CryptoJS.enc.Hex), "hex"),
          Buffer.from(hashSequence.toString(CryptoJS.enc.Hex), "hex"),
          Buffer.from(input.txid, "hex").reverse(),
          u32le(input.vout),
          Buffer.from([scriptCode.length]),
          scriptCode,
          valueBuffer,
          Buffer.from([0xff, 0xff, 0xff, 0xff]), // sequence
          Buffer.from(hashOutputs.toString(CryptoJS.enc.Hex), "hex"),
          u32le(tx.locktime),
          u32le(hashType),
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
      const isSegwitNative =
        prevOutput.script.length === 22 && prevOutput.script[0] === 0x00 && prevOutput.script[1] === 0x14;

      // Detect Segwit (wrapped SegWit) from BIP49 derivation path (m/49'/...)
      const purpose = input.addressNList[0] & ~0x80000000; // Remove hardening bit
      const isSegwit = purpose === 49;

      if (isSegwitNative) {
        // Segwit Native (P2WPKH): empty scriptSig, signature + pubkey in witness
        finalTx.ins[i].script = Buffer.alloc(0);
        finalTx.ins[i].witness = [derSig, compressedPubkey];
      } else if (isSegwit) {
        // Segwit (P2SH-P2WPKH): redeemScript in scriptSig, signature + pubkey in witness
        // redeemScript format: OP_0 OP_PUSH20 <hash160(pubkey)>
        const pubkeyHash = bitcoin.crypto.hash160(compressedPubkey);
        const redeemScript = bitcoin.script.compile([bitcoin.opcodes.OP_0, pubkeyHash]);

        // scriptSig contains the redeemScript
        finalTx.ins[i].script = bitcoin.script.compile([redeemScript]);
        // Witness contains signature + pubkey
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
