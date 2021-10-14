import * as core from "@shapeshiftoss/hdwallet-core";

export class MetaMaskHDWallet implements core.HDWallet, core.ETHWallet{
    readonly _supportsETH = true;
    readonly _supportsETHInfo = true;
    readonly _supportsBTCInfo = false;
    readonly _supportsBTC = false;
    readonly _supportsCosmosInfo = false;
    readonly _supportsCosmos = false;
    readonly _supportsOsmosisInfo = false;
    readonly _supportsOsmosis = false;
    readonly _supportsBinanceInfo = false;
    readonly _supportsBinance = false;
    readonly _supportsDebugLink = false;
    readonly _isPortis = false;
    readonly _supportsRippleInfo = false;
    readonly _supportsRipple = false;
    readonly _supportsEosInfo = false;
    readonly _supportsEos = false;
    readonly _supportsFioInfo = false;
    readonly _supportsFio = false;
    readonly _supportsThorchainInfo = false;
    readonly _supportsThorchain = false;
    readonly _supportsSecretInfo = false;
    readonly _supportsSecret = false;
    readonly _supportsKava = false;
    readonly _supportsKavaInfo = false;
    readonly _supportsTerra = false;
    readonly _supportsTerraInfo = false;

    info: MetaMaskHDWalletInfo & core.HDWalletInfo;
    ethAddress?: string;
}