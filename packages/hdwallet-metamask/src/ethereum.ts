import * as core from "@shapeshiftoss/hdwallet-core";

export function describeETHPath(path: core.BIP32Path): core.PathDescription{
    return undefined;
}

export async function ethVerifyMessage(msg: core.ETHVerifyMessage, web3: any): Promise<boolean>{
    return false;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath>{
    return undefined;
}

export async function ethSignTx(msg: core.ETHSignTx, web3: any, from: string): Promise<core.ETHSignedTx>{
    return undefined;
}

export async function ethSignMessage(msg:core.ETHSignMessage, web3: any, address:string): Promise<core.ETHSignedMessage>{
    return undefined;
}