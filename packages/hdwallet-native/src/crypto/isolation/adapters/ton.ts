import * as core from "@shapeshiftoss/hdwallet-core";
import { WalletContractV4 } from "@ton/ton";
import {
  Address,
  beginCell,
  Cell,
  internal,
  MessageRelaxed,
  SendMode,
  storeMessage,
  storeMessageRelaxed,
} from "@ton/core";

import { Isolation } from "../..";

const ED25519_PUBLIC_KEY_SIZE = 32;

export interface TonTransactionParams {
  from: string;
  to: string;
  value: string;
  seqno: number;
  expireAt: number;
  memo?: string;
  contractAddress?: string;
  type?: "transfer" | "jetton_transfer";
}

export class TonAdapter {
  protected readonly nodeAdapter: Isolation.Adapters.Ed25519;

  constructor(nodeAdapter: Isolation.Adapters.Ed25519) {
    this.nodeAdapter = nodeAdapter;
  }

  async getAddress(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();

    if (publicKey.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw new Error(`Invalid Ed25519 public key size: ${publicKey.length}`);
    }

    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: Buffer.from(publicKey),
    });

    return wallet.address.toString({ bounceable: false });
  }

  async getPublicKey(addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await nodeAdapter.getPublicKey();
    return Buffer.from(publicKey).toString("hex");
  }

  async createSignedTransferBoc(params: TonTransactionParams, addressNList: core.BIP32Path): Promise<string> {
    const derivedNodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const publicKey = await derivedNodeAdapter.getPublicKey();

    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: Buffer.from(publicKey),
    });

    const destination = Address.parse(params.to);

    let internalMessage: MessageRelaxed;

    if (params.type === "jetton_transfer" && params.contractAddress) {
      const jettonWalletAddress = Address.parse(params.contractAddress);
      const forwardPayload = params.memo
        ? beginCell().storeUint(0, 32).storeStringTail(params.memo).endCell()
        : beginCell().endCell();

      const jettonTransferBody = beginCell()
        .storeUint(0x0f8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(BigInt(params.value))
        .storeAddress(destination)
        .storeAddress(Address.parse(params.from))
        .storeBit(false)
        .storeCoins(BigInt(1))
        .storeBit(true)
        .storeRef(forwardPayload)
        .endCell();

      internalMessage = internal({
        to: jettonWalletAddress,
        value: BigInt(100000000),
        bounce: true,
        body: jettonTransferBody,
      });
    } else {
      internalMessage = internal({
        to: destination,
        value: BigInt(params.value),
        bounce: true,
        body: params.memo ? beginCell().storeUint(0, 32).storeStringTail(params.memo).endCell() : beginCell().endCell(),
      });
    }

    const signer = async (message: Cell): Promise<Buffer> => {
      const hash = message.hash();
      const signature = await derivedNodeAdapter.node.sign(hash);
      return Buffer.from(signature);
    };

    const transfer = await wallet.createTransfer({
      seqno: params.seqno,
      signer,
      messages: [internalMessage],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout: params.expireAt,
    });

    const externalMessage = beginCell()
      .store(
        storeMessage({
          info: {
            type: "external-in",
            dest: wallet.address,
            importFee: BigInt(0),
          },
          init: params.seqno === 0 ? wallet.init : null,
          body: transfer,
        })
      )
      .endCell();

    const boc = externalMessage.toBoc().toString("base64");

    // Debug logging
    console.log("[TON] createSignedTransferBoc debug:");
    console.log("  seqno:", params.seqno);
    console.log("  includesInit:", params.seqno === 0);
    console.log("  walletAddress:", wallet.address.toString({ bounceable: false }));
    console.log("  destAddress:", params.to);
    console.log("  value:", params.value);
    console.log("  bocLength:", boc.length);
    console.log("  bocPrefix:", boc.substring(0, 50));

    return boc;
  }

  async signTransaction(message: Uint8Array, addressNList: core.BIP32Path): Promise<string> {
    const nodeAdapter = await this.nodeAdapter.derivePath(core.addressNListToHardenedBIP32(addressNList));
    const signature = await nodeAdapter.node.sign(message);
    return Buffer.from(signature).toString("hex");
  }
}

export default TonAdapter;
