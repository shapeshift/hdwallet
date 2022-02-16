import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoinMsg from "bitcoinjs-message";
import Base64 from "base64-js";

export async function btcGetAddress(bitcoin: any): Promise<string | null> {
  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "request_accounts",
        },
        (err: any, bitcoinAccounts: string[]) => {
          if (err) rej(err);
          res(bitcoinAccounts[0]);
        }
      );
    } catch (error) {
      console.error(error);
      rej(error);
    }
  });
}

export async function btcSignTx(msg: core.BTCSignTx, address: string, bitcoin: any): Promise<core.BTCSignedTx | null> {
  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "sign_transaction",
          params: [{ msg, from: address }],
        },
        (err: any, result: core.BTCSignedTx) => {
          if (err) rej(err);
          res(result);
        }
      );
    } catch (error) {
      rej(error);
    }
  });
}

export async function btcSignMessage(
  msg: core.BTCSignMessage,
  address: string,
  bitcoin: any
): Promise<core.BTCSignedMessage | null> {
  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "sign_transaction",
          params: [{ msg, from: address }],
        },
        (err: any, result: string) => {
          if (err) rej(err);
          res({
            address,
            signature: result,
          });
        }
      );
    } catch (error) {
      console.error(error);
      rej(error);
    }
  });
}

export async function btcVerifyMessage(msg: core.BTCVerifyMessage) {
  try {
    const signature = Base64.fromByteArray(core.fromHexString(msg.signature));
    return bitcoinMsg.verify(msg.message, msg.address, signature);
  } catch (error) {
    console.log(`Error ocurred while verifying signature: ${error}`);
    return false;
  }
}
