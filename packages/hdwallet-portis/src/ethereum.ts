import * as core from "@shapeshiftoss/hdwallet-core";

export async function ethVerifyMessage(msg: core.ETHVerifyMessage, web3: any): Promise<boolean> {
  const signingAddress = await web3.eth.accounts.recover(msg.message, "0x" + msg.signature, false);
  return signingAddress === msg.address;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "Portis",
    },
  ];
}

export async function ethSignTx(msg: core.ETHSignTx, web3: any, from: string): Promise<core.ETHSignedTx> {
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

export async function ethSignMessage(msg: core.ETHSignMessage, web3: any, address: string): Promise<core.ETHSignedMessage> {
  const result = await web3.eth.sign(msg.message, address);
  return {
    address,
    signature: result,
  };
}
