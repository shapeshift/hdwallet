import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoinMsg from "bitcoinjs-message";

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

/**
 * return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "transfer",
          params: [
            {
              asset: {
                chain: "BTC",
                symbol: "BTC",
                ticker: "BTC",
              },
              from: address,
              amount: {
                amount: inputs[0].amount,
                decimals: 8,
              },
              recipient: outputs[0].address,
            },
          ],
        },
        (err: any, result: any) => {
          console.log("🚀 ~ file: bitcoin.ts ~ line 44 ~ returnnewPromise ~ bitcoinAccounts", result);
          if (err) rej(err);
          res(result);
        }
      );
    } catch (error) {
      console.error(error);
      rej(error);
    }
  }); 
  
  */
export async function btcSignTx(msg: core.BTCSignTx, address: string, bitcoin: any): Promise<core.BTCSignedTx | null> {
  const { coin, inputs, outputs, version, locktime } = msg;

  if (!bitcoin) throw new Error("XDEFI Bitcoin Provider not found");

  if (!(bitcoin && bitcoin.request)) {
    return null;
  }

  return new Promise((res, rej) => {
    try {
      bitcoin.request(
        {
          method: "transfer",
          params: [
            {
              msg,
              from: address,
              recipient: msg.outputs[0].address,
              amount: {
                amount: "0",
                decimals: 8,
              },
            },
          ],
        },
        (err: any, result: any) => {
          console.log("🚀 ~ file: bitcoin.ts ~ line 44 ~ returnnewPromise ~ bitcoinAccounts", result);
          if (err) rej(err);
          res(result);
        }
      );
    } catch (error) {
      console.error(error);
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
    return bitcoinMsg.verify(msg.message, msg.address, msg.signature, undefined, true);
  } catch (error) {
    console.log(`Error ocurred while verifying signature: ${error}`);
    return false;
  }
}
