import * as core from "@shapeshiftoss/hdwallet-core";

export class NativeETHWalletInfo implements core.ETHWalletInfo {
  _supportsETHInfo = true;

  ethSupportsNetwork(): Promise<boolean> {
    return Promise.resolve(true);
  }

  ethSupportsSecureTransfer(): Promise<boolean> {
    return Promise.resolve(false);
  }

  ethSupportsNativeShapeShift(): boolean {
    return false;
  }

  ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
    return [
      {
        addressNList: [
          0x80000000 + 44,
          0x80000000 + core.slip44ByCoin(msg.coin),
          0x80000000 + msg.accountIdx,
          0,
          0,
        ],
        hardenedPath: [
          0x80000000 + 44,
          0x80000000 + core.slip44ByCoin(msg.coin),
          0x80000000 + msg.accountIdx,
        ],
        relPath: [0, 0],
        description: "Native",
      },
    ];
  }

  ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath {
    let addressNList = msg.hardenedPath.concat(msg.relPath);
    const description = core.describeETHPath(addressNList);

    if (!description.isKnown) {
      return undefined;
    }

    if (addressNList[0] === 0x80000000 + 44) {
      addressNList[2] += 1;
      return {
        ...msg,
        addressNList,
        hardenedPath: core.hardenedPath(addressNList),
        relPath: core.relativePath(addressNList),
      };
    }

    return undefined;
  }
}

export class NativeETHWallet extends NativeETHWalletInfo
  implements core.ETHWallet {
  _supportsETH = true;

  ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
    // TODO: implement
    return Promise.resolve(null);
  }
  ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
    // TODO: implement
    return Promise.resolve(null);
  }
  ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
    return Promise.resolve(null);
  }
  ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
    return Promise.resolve(null);
  }
}
