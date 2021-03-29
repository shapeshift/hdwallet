import * as core from "@shapeshiftoss/hdwallet-core";
import { BIP32Interface } from "bitcoinjs-lib";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import { toWords, encode } from "bech32";
import CryptoJS, { RIPEMD160, SHA256 } from "crypto-js";
import util from "./util";

// Forked repo for offline signing
// https://github.com/BitHighlander/SecretNetwork/blob/master/cosmwasm-js/packages/sdk/package.json#L2
const {
  EnigmaUtils, SigningCosmWasmClient, Secp256k1Pen, pubkeyToAddress, encodeSecp256k1Pubkey
} = require("secretjs-offline");

export function MixinNativeSecretWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeSecretWalletInfo extends Base implements core.SecretWalletInfo {
    _supportsSecretInfo = true;
    async secretSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async secretSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    secretSupportsNativeShapeShift(): boolean {
      return false;
    }

    secretGetAccountPaths(msg: core.SecretGetAccountPaths): Array<core.SecretAccountPath> {
      const slip44 = core.slip44ByCoin("Secret")
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
        },
      ];
    }

    secretNextAccountPath(msg: core.SecretAccountPath): core.SecretAccountPath {
      // Only support one account for now (like portis).
      return undefined;
    }
  };
}

export function MixinNativeSecretWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  return class MixinNativeSecretWallet extends Base {
    _supportsSecret = true;

    #wallet: BIP32Interface;
    #seed: string;

    async secretInitializeWallet(seed: Buffer): Promise<void> {
      const network = getNetwork("secret");
      this.#wallet = bitcoin.bip32.fromSeed(seed, network);
    }

    secretSetMnemonic(mnemonic: string): void {
      this.#seed = mnemonic
    }

    secretWipe(): void {
      this.#wallet = undefined;
    }

    bech32ify(address: ArrayLike<number>, prefix: string): string {
      const words = toWords(address);
      return encode(prefix, words);
    }

    createSecretAddress(publicKey: string) {
      const message = SHA256(CryptoJS.enc.Hex.parse(publicKey));
      const hash = RIPEMD160(message as any).toString();
      const address = Buffer.from(hash, `hex`);
      return this.bech32ify(address, `secret`);
    }

    async secretGetAddress(msg: core.SecretGetAddress): Promise<string> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        return this.createSecretAddress(util.getKeyPair(this.#wallet, msg.addressNList, "secret").publicKey);
      });
    }

    async secretSignTx(msg: core.SecretSignTx): Promise<any> {
      return this.needsMnemonic(!!this.#wallet, async () => {
        console.log("msg: ",msg)
        console.log("msg: ",JSON.stringify(msg))

        const httpUrl = '';
        const signingPen = await Secp256k1Pen.fromMnemonic(this.#seed);
        const pubkey = encodeSecp256k1Pubkey(signingPen.pubkey);
        const accAddress = pubkeyToAddress(pubkey, 'secret');

        const txEncryptionSeed = EnigmaUtils.GenerateNewSeed();
        const fees = {
          send: {
            amount: [{ amount: this.#wallet, denom: "uscrt" }],
            gas: "80000",
          },
        }
        const client = new SigningCosmWasmClient(
          httpUrl,
          accAddress,
          (signBytes:any) => signingPen.sign(signBytes),
          txEncryptionSeed, fees
        );

        const rcpt = msg.tx.msg[0].value.to_address; // Set recipient to sender for testing
        const amount = msg.tx.msg[0].value.amount[0].amount; // Set recipient to sender for testing
        const chainId = msg.chain_id
        const accountNumber = msg.account_number
        const sequence = msg.sequence
        const memo = msg.tx.memo
        console.log("params: ",{rcpt,chainId, accountNumber, sequence, memo})

        const sent = await client.sendTokensOffline(rcpt, [{amount: amount, denom: "uscrt"}],chainId, accountNumber, sequence, memo)

        return sent;
      });
    }
  };
}
