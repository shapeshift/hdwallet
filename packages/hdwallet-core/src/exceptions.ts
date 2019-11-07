export enum HDWalletErrorType {
    ActionCancelled = 'ActionCancelled',
    DeviceDisconnected = 'DeviceDisconnected',
    DisconnectedDeviceDuringOperation = 'DisconnectedDeviceDuringOperation',
    PopupClosedError = 'PopupClosedError',
    ConflictingApp = 'ConflictingApp',
    SelectApp = 'SelectApp',
    WrongApp = 'WrongApp',
    FirmwareUpdateRequired = 'FirmwareUpdateRequired',
    WebUSBNotAvailable = 'WebUSBNotAvailable',
    WebUSBCouldNotInitialize = 'WebUSBCouldNotInitialize',
    WebUSBCouldNotPair = 'WebUSBCouldNotPair',
    NavigateToDashboard = 'NavigateToDashboard'
}

export class HDWalletError extends Error {
    type: HDWalletErrorType

    constructor (message: string, type: HDWalletErrorType) {
        super(message)
        this.name = type
        this.type = type
        this.message = message
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}

export class ActionCancelled extends HDWalletError {
    constructor () {
        super('Action cancelled', HDWalletErrorType.ActionCancelled)
    }
}

export class DeviceDisconnected extends HDWalletError {
    constructor () {
        super('Device disconnected', HDWalletErrorType.DeviceDisconnected)
    }
}

export class DisconnectedDeviceDuringOperation extends HDWalletError {
    constructor () {
        super('Ledger device disconnected during operation', HDWalletErrorType.DisconnectedDeviceDuringOperation)
    }
}

export class PopupClosedError extends HDWalletError {
    constructor () {
        super('TrezorConnect popup closed', HDWalletErrorType.PopupClosedError)
    }
}

export class ConflictingApp extends HDWalletError {
    model: string

    constructor (model: string) {
        super(`Conflicting Application: Another wallet is trying to connect with your ${model}.`,
              HDWalletErrorType.ConflictingApp)
        this.model = model
    }
}

export class SelectApp extends HDWalletError {
    constructor (model: string, app: string) {
        super(`Please open the ${app} app on your ${model}.`,
              HDWalletErrorType.SelectApp)
    }
}

export class WrongApp extends HDWalletError {
    constructor (model: string, app: string) {
        super(`Wrong app selected. Please open the ${app} app on your ${model}.`,
              HDWalletErrorType.WrongApp)
    }
}

export class FirmwareUpdateRequired extends HDWalletError {
    constructor (model: string, minVer: string) {
        super(`Firmware ${minVer} or later is required to use your ${model} with this client. Please update your device.`,
              HDWalletErrorType.FirmwareUpdateRequired)
    }
}

export class WebUSBNotAvailable extends HDWalletError {
    constructor () {
        super(`WebUSB is not available in this browser. We recommend trying Chrome.`,
              HDWalletErrorType.WebUSBNotAvailable)
    }
}

export class WebUSBCouldNotInitialize extends HDWalletError {
    constructor (model: string, message: string) {
        super(`Could not initialize ${model}: ${message}`, HDWalletErrorType.WebUSBCouldNotInitialize)
    }
}

export class WebUSBCouldNotPair extends HDWalletError {
    constructor (model: string, message: string) {
        super(`Could not pair ${model}: ${message}`, HDWalletErrorType.WebUSBCouldNotPair)
    }
}

export class NavigateToDashboard extends HDWalletError {
    constructor (model: string) {
      super(`Please navigate to the dashboard of your ${model}.`,
        HDWalletErrorType.NavigateToDashboard)
    }
}
