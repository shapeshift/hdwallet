import {
  ActionCancelled,
  DeviceDisconnected,
  PopupClosedError,
} from '@shapeshiftoss/hdwallet-core'

import { TrezorTransport } from './transport'

export function handleError (transport: TrezorTransport, result: any, message: string): void {
  if (result.success)
    return

  if (result.payload.code === "Failure_ActionCancelled")
    throw new ActionCancelled()

  if (result.payload.error === "device disconnected during action" ||
      result.payload.error === "Device disconnected")
    throw new DeviceDisconnected()

  if (result.payload.error === "Popup closed")
    throw new PopupClosedError()

  throw new Error(`${message}: '${result.payload.error}'`)
}