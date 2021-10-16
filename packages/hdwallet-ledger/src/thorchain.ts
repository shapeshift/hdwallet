import * as core from "@shapeshiftoss/hdwallet-core";
import * as txBuilder from "tendermint-tx-builder";
import { LedgerError, LedgerErrorType } from "@thorchain/ledger-thorchain"

import { LedgerTransport } from "./transport";
import { handleError } from "./utils";

function handleThorchainAppError(res: {returnCode: LedgerErrorType, errorMessage?: string}) {
  if (res.returnCode !== LedgerErrorType.NoErrors) {
    throw new LedgerError(res.returnCode, res.errorMessage)
  }
}

export async function thorchainGetAddress(transport: LedgerTransport, msg: core.ThorchainGetAddress): Promise<string> {
  const res = await transport.call("THORChain", "getAddressAndPubKey", msg.addressNList, "thor");
  handleError(res, transport, "Unable to obtain THORChain address from device.");
  handleThorchainAppError(res.payload)

  return res.payload.bech32Address;
}

export async function thorchainGetPublicKeys(
  transport: LedgerTransport,
  msg: Array<core.GetPublicKey>
): Promise<Array<core.PublicKey | null>> {
  throw new Error("unable to get THORChain public keys -- Ledger app does not support exporting chain code")
}

export async function thorchainSignTx(transport: LedgerTransport, msg: core.ThorchainSignTx): Promise<core.ThorchainSignedTx> {
  const publicKeyRes = await transport.call("THORChain", "getPublicKey", msg.addressNList)
  handleError(publicKeyRes, transport, "Could not get THORChain public key")
  handleThorchainAppError(publicKeyRes.payload)

  const adapter = {
    publicKey: Buffer.from(publicKeyRes.payload.compressedPk).toString("hex"),
    async sign(signMessage: string): Promise<Buffer> {
      const res = await transport.call("THORChain", "sign", msg.addressNList, signMessage)
      handleError(res, transport, "Could not sign THORChain tx with Ledger")
      return core.mustBeDefined(res.payload.signature)
    }
  }

  const result = await txBuilder.sign(msg.tx, adapter, msg.sequence, msg.account_number, "thorchain");
  return txBuilder.createSignedTx(msg.tx, result);
}

// TODO: from hdwallet-keepkey; should probably be factored out to core
export function thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Thorchain"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}
