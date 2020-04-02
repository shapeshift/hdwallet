import {
  PathDescription,
  addressNListToBIP32,
  BIP32Path,
  slip44ByCoin,
  ETHVerifyMessage,
  ETHGetAccountPath,
  ETHAccountPath,
  ETHSignTx,
  ETHSignedTx,
  ETHSignMessage,
  ETHSignedMessage,
} from "@shapeshiftoss/hdwallet-core";

export function describeETHPath(path: BIP32Path): PathDescription {
  let pathStr = addressNListToBIP32(path);
  let unknown: PathDescription = {
    verbose: pathStr,
    coin: "Ethereum",
    isKnown: false,
  };

  if (path.length !== 5) return unknown;

  if (path[0] !== 0x80000000 + 44) return unknown;

  if (path[1] !== 0x80000000 + slip44ByCoin("Ethereum")) return unknown;

  if ((path[2] & 0x80000000) >>> 0 !== 0x80000000) return unknown;

  if (path[3] !== 0) return unknown;

  if (path[4] !== 0) return unknown;

  let index = path[2] & 0x7fffffff;
  return {
    verbose: `Ethereum Account #${index}`,
    accountIdx: index,
    wholeAccount: true,
    coin: "Ethereum",
    isKnown: true,
  };
}

export async function ethVerifyMessage(
  msg: ETHVerifyMessage,
  web3: any
): Promise<boolean> {
  const signingAddress = await web3.eth.accounts.recover(
    msg.message,
    "0x" + msg.signature,
    false
  );
  return signingAddress === msg.address;
}

export function ethGetAccountPaths(
  msg: ETHGetAccountPath
): Array<ETHAccountPath> {
  return [
    {
      addressNList: [
        0x80000000 + 44,
        0x80000000 + slip44ByCoin(msg.coin),
        0x80000000 + msg.accountIdx,
        0,
        0,
      ],
      hardenedPath: [
        0x80000000 + 44,
        0x80000000 + slip44ByCoin(msg.coin),
        0x80000000 + msg.accountIdx,
      ],
      relPath: [0, 0],
      description: "Portis",
    },
  ];
}

export async function ethSignTx(
  msg: ETHSignTx,
  web3: any,
  from: string
): Promise<ETHSignedTx> {
  const result = await web3.eth.signTransaction({
    from,
    to: msg.to,
    value: msg.value,
    gas: msg.gasLimit,
    gasPrice: msg.gasPrice,
    data: msg.data,
    nonce: msg.nonce,
  });
  return {
    v: result.tx.v,
    r: result.tx.r,
    s: result.tx.s,
    serialized: result.raw,
  };
}

export async function ethSignMessage(
  msg: ETHSignMessage,
  web3: any,
  address: string
): Promise<ETHSignedMessage> {
  const result = await web3.eth.sign(msg.message, address);
  return {
    address,
    signature: result,
  };
}
