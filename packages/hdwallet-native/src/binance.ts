import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import BigNumber from "bignumber.js";
import type * as bnbSdkTypes from "bnb-javascript-sdk-nobroadcast";
import CryptoJS from "crypto-js";
import PLazy from "p-lazy";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import * as util from "./util";

const bnbSdk = PLazy.from(() => import("bnb-javascript-sdk-nobroadcast"));

export function MixinNativeBinanceWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeBinanceWalletInfo extends Base implements core.BinanceWalletInfo {
    readonly _supportsBinanceInfo = true;

    async binanceSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async binanceSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    binanceSupportsNativeShapeShift(): boolean {
      return false;
    }

    binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
      const slip44 = core.slip44ByCoin("Binance");
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    binanceNextAccountPath(msg: core.BinanceAccountPath): core.BinanceAccountPath | undefined {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeBinanceWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeBinanceWallet extends Base {
    readonly _supportsBinance = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async binanceInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    binanceWipe(): void {
      this.#masterKey = undefined;
    }

    binanceBech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = bech32.toWords(address);
      return bech32.encode(prefix, words);
    }

    createBinanceAddress(publicKey: string, testnet?: boolean) {
      const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = CryptoJS.RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.binanceBech32ify(address, `${testnet ? "t" : ""}bnb`);
    }

    async binanceGetAddress(msg: core.BinanceGetAddress & { testnet?: boolean }): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "binance");
        return this.createBinanceAddress(keyPair.publicKey.toString("hex"), msg.testnet ?? false);
      });
    }

    async binanceSignTx(msg: core.BinanceSignTx & { testnet?: boolean }): Promise<core.BinanceSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, msg.addressNList, "binance");

        const tx = Object.assign({}, msg.tx);
        if (!tx.data) tx.data = null;
        if (!tx.memo) tx.memo = "";
        if (!tx.sequence) tx.sequence = "0";
        if (!tx.source) tx.source = "0";

        const client = new (await bnbSdk).BncClient(
          msg.testnet ? "https://testnet-dex.binance.org" : "https://dex.binance.org"
        ); // broadcast not used but available
        await client.chooseNetwork(msg.testnet ? "testnet" : "mainnet");
        const haveAccountNumber = !!msg.tx.account_number && Number.isInteger(Number(msg.tx.account_number));
        if (haveAccountNumber) await client.setAccountNumber(Number(msg.tx.account_number));
        client.setSigningDelegate(await Isolation.Adapters.Binance.create(keyPair.node));

        await client.initChain();

        if (!tx.chain_id) {
          const { chainId } = client;
          if (!chainId) throw new Error("unable to load chain id");
          tx.chain_id = chainId;
        }
        if (!tx.account_number) {
          const { account_number } = client;
          if (account_number) tx.account_number = account_number.toString();
        }

        if (
          tx.msgs?.length !== 1 ||
          tx.msgs[0].inputs?.length !== 1 ||
          tx.msgs[0].inputs[0].coins?.length !== 1 ||
          tx.msgs[0].outputs?.length !== 1 ||
          tx.msgs[0].outputs[0].coins?.length !== 1
        )
          throw new Error("malformed or unsupported tx message");

        const addressTo = tx.msgs[0].outputs[0].address;
        const addressFrom = tx.msgs[0].inputs[0].address;
        const addressFromVerify = this.createBinanceAddress(keyPair.publicKey.toString("hex"), !!msg.testnet);
        if (addressFrom !== addressFromVerify) throw Error("Invalid permissions to sign for address");

        if (!tx.account_number) {
          const { result, status }: { result: Record<string, unknown>; status: number } = core.mustBeDefined(
            await client.getAccount(addressFrom)
          );
          if (!(status === 200 && "account_number" in result && typeof result.account_number === "number"))
            throw new Error("unable to load account number");
          tx.account_number = result.account_number.toString();
        }

        // The Binance SDK takes amounts as decimal strings.
        const amount = new BigNumber(tx.msgs[0].inputs[0].coins[0].amount);
        if (!amount.isInteger()) throw new Error("amount must be an integer");
        if (!amount.isEqualTo(tx.msgs[0].outputs[0].coins[0].amount))
          throw new Error("amount in input and output must be equal");
        const asset = tx.msgs[0].inputs[0].coins[0].denom;
        if (asset !== tx.msgs[0].outputs[0].coins[0].denom)
          throw new Error("denomination in input and output must be the same");

        const result = (await client.transfer(
          addressFrom,
          addressTo,
          amount.shiftedBy(-8).toString(),
          asset,
          tx.memo,
          Number(tx.sequence) ?? null
        )) as unknown as Omit<bnbSdkTypes.Transaction, "accountNumber" | "msgs" | "signatures"> & {
          accountNumber: number;
          // msgs: core.BinanceTx["msgs"],
          signatures: Array<{
            pub_key: Buffer;
            signature: string;
          }>;
        };
        const serialized = result.serialize();

        const aminoPubKey: Buffer = result.signatures[0].pub_key;
        const signature = Buffer.from(result.signatures[0].signature, "base64").toString("base64");

        // The BNB SDK returns public keys serialized in its own format. The first four bytes are a type
        // tag, and the fifth is the length of the rest of the data, which is always exactly 33 bytes.
        if (
          aminoPubKey.length !== 38 ||
          aminoPubKey.readUInt32BE(0) !== 0xeb5ae987 ||
          aminoPubKey.readUInt8(4) !== 33
        ) {
          throw new Error("Binance SDK returned public key in an incorrect format");
        }
        const pub_key = aminoPubKey.slice(5).toString("base64");

        return Object.assign(
          {
            account_number: result.accountNumber,
          },
          tx as core.BinanceTx,
          {
            // msgs: result.msgs,
            signatures: {
              pub_key,
              signature,
            },
            serialized,
            txid: CryptoJS.SHA256(CryptoJS.enc.Hex.parse(serialized)).toString(),
          }
        );
      });
    }
  };
}
