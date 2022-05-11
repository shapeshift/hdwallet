import * as core from "@shapeshiftoss/hdwallet-core";
import {
  CosmosAccountPath,
  CosmosGetAccountPaths,
  CosmosGetAddress,
  CosmosSignedTx,
  CosmosSignTx,
  slip44ByCoin,
} from "@shapeshiftoss/hdwallet-core";
import { SigningStargateClient } from "@cosmjs/stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { Window as KeplrWindow } from "@keplr-wallet/types";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";

export function cosmosDescribePath(path: core.BIP32Path): core.PathDescription {
  let pathStr = core.addressNListToBIP32(path);
  let unknown: core.PathDescription = {
    verbose: pathStr,
    coin: "Atom",
    isKnown: false,
  };

  if (path.length != 5) {
    return unknown;
  }

  if (path[0] != 0x80000000 + 44) {
    return unknown;
  }

  if (path[1] != 0x80000000 + slip44ByCoin("Atom")) {
    return unknown;
  }

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) {
    return unknown;
  }

  if (path[3] !== 0 || path[4] !== 0) {
    return unknown;
  }

  let index = path[2] & 0x7fffffff;
  return {
    verbose: `Cosmos Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Atom",
    isKnown: true,
    isPrefork: false,
  };
}

export enum cosmosSigningModes {
  AMINO = 1,
  PROTOBUF = 2,
}

export function cosmosGetAccountPaths(msg: CosmosGetAccountPaths): Array<CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function cosmosSignTx(msg: CosmosSignTx, state: any): Promise<CosmosSignedTx> {
  const chainId = "cosmoshub-4";
  await state.enable(chainId);
  const offlineSigner = state.provider.getOfflineSigner(chainId);
  const accounts = await offlineSigner.getAccounts();
  const address = accounts[0].address;

  const messages: EncodeObject[] = msg.tx.msg.map((msg) => ({ typeUrl: msg.type, value: msg.value }));

  /**
   * todo: Replace RPC endpoint with a production-ready one.
   */
  const client = await SigningStargateClient.connectWithSigner("https://rpc-cosmos.blockapsis.com", offlineSigner);
  const txRaw = await client.sign(address, messages, msg.tx.fee, msg.tx.memo || "");
  const encoded = TxRaw.encode(txRaw).finish();
  const output: CosmosSignedTx = {
    serialized: Buffer.from(encoded).toString("base64"),
    body: Buffer.from(txRaw.bodyBytes).toString("base64"),
    authInfoBytes: Buffer.from(txRaw.authInfoBytes).toString("base64"),
    signatures: txRaw.signatures.map((x) => Buffer.from(x).toString("base64")),
  };
  return output;
}

export async function cosmosGetAddress(msg: CosmosGetAddress): Promise<string | undefined> {
  const chainId = "cosmoshub-4";
  await window?.keplr?.enable(chainId);
  const offlineSigner = window?.keplr?.getOfflineSigner(chainId);
  const cosmosAddress = (await offlineSigner?.getAccounts())?.[0].address;
  return cosmosAddress;
}

export async function cosmosSendTx(msg: CosmosSignTx, state: any): Promise<string | null> {
  const chainId = "cosmoshub-4";
  await window?.keplr?.enable(chainId);
  const offlineSigner = state.provider.getOfflineSigner(chainId);
  const client = await SigningStargateClient.connectWithSigner("https://rpc-cosmos.blockapsis.com", offlineSigner);

  // const resp: DeliverTxResponse = client.broadcastTx(msg.tx);
  const ret: string = "";
  return ret;
}
