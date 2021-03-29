import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";
import cosmosjs from "@cosmostation/cosmosjs";

export function MixinNativeKavaWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeKavaWalletInfo extends Base implements core.KavaWalletInfo {
    _supportsKavaInfo = true;
    async kavaSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async kavaSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    kavaSupportsNativeShapeShift(): boolean {
      return false;
    }

    kavaGetAccountPaths(msg: core.KavaGetAccountPaths): Array<core.KavaAccountPath> {
      const slip44 = core.slip44ByCoin("Kava")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    kavaNextAccountPath(msg: core.KavaAccountPath): core.KavaAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeKavaWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeKavaWallet extends Base {
    _supportsKava = true;

    #wallet: bitcoin.BIP32Interface;
    #seed: string

    async kavaInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("kava");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    kavaSetMnemonic(mnemonic: string): void {
      this.#seed = mnemonic
    }

    kavaWipe(): void {
      this.#wallet = undefined;
      this.#seed = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createKavaAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `kava`);
    }

    async kavaGetAddress(msg: core.KavaGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createKavaAddress(util.getKeyPair(this.#wallet, msg.addressNList, "kava").publicKey);
      });
    }

    async kavaSignTx(msg: core.KavaSignTx): Promise<core.KavaSignedTx> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        const chainId = msg.chain_id || "kava-6"
        const kava = cosmosjs.network(" ", chainId);
        const ecpairPriv = kava.getECPairPriv(this.#seed);
        const amount = msg.tx.msg[0].value.amount[0].amount;
        const to = msg.tx.msg[0].value.to_address
        const from = msg.tx.msg[0].value.from_address
        const accountNumber = msg.account_number
        const sequence = msg.sequence

        let stdSignMsg = kava.newStdMsg({
          msgs: [
            {
              type: "cosmos-sdk/MsgSend",
              value: {
                amount: [
                  {
                    amount: String(amount), 	// 6 decimal places (1000000 ukava = 1 KAVA)
                    denom: "ukava"
                  }
                ],
                from_address: from,
                to_address: to
              }
            }
          ],
          chain_id: chainId,
          fee: { amount: [ { amount: String(5000), denom: "ukava" } ], gas: String(200000) },
          memo: "",
          account_number: String(accountNumber),		// If the address is a vesting account, use account_number of base_vesting_account
          sequence: String(sequence)					// If the address is a vesting account, use sequence of base_vesting_account
        });

        const signedTx = kava.sign(stdSignMsg, ecpairPriv);

        return signedTx.tx
      });
    }
  };
}
