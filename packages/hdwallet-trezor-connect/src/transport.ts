import { Events, makeEvent, Keyring, HDWalletErrorType, ActionCancelled } from "@shapeshiftoss/hdwallet-core";
import { TrezorHDWallet, TrezorTransport, TrezorConnectResponse } from "@shapeshiftoss/hdwallet-trezor";
import TrezorConnect, { DEVICE_EVENT, UI_EVENT } from "trezor-connect";

export const POPUP = true;

export type TrezorDevice = {
  path: string;
  deviceID: string;
};

export class TrezorConnectTransport extends TrezorTransport {
  readonly hasPopup = POPUP;
  device: TrezorDevice;

  /// Gobal, shared between all instances of this class, since TrezorConnect only
  /// allows us to make one device call at a time.
  static callInProgress: Promise<any> = undefined;

  public static async cancellable(inProgress: Promise<any>): Promise<void> {
    try {
      // We thrrow away the result, since it's either undefined, or meant for the
      // other concurrent thread, possibly involving a different TrezorConnectTransport.
      await inProgress;
    } catch (e) {
      // Unless it's a cancel, throw away the error, as the other context will handle it.
      if (e.type === HDWalletErrorType.ActionCancelled) {
        TrezorConnectTransport.callInProgress = undefined;
        throw e;
      }
    }
  }

  constructor(device: TrezorDevice, keyring: Keyring) {
    super(keyring);
    this.device = device;
  }

  public getDeviceID(): string {
    return this.device.deviceID;
  }

  public async connect(): Promise<void> {
    TrezorConnect.on(DEVICE_EVENT, (event: any) => {
      if (!this.device.path && event.features && event.path && event.features.device_id === this.device.deviceID) {
        this.device.path = event.path;
      }
    });

    TrezorConnect.on(UI_EVENT, (event) => {
      if (!event.payload) return;

      if (!event.payload.device) return;

      if (!event.payload.device.features) return;

      if (this.device.deviceID !== event.payload.device.features.device_id) return;

      // Log TrezorConnect's event raw:
      this.emit(
        event.type,
        makeEvent({
          message_type: event.type,
          message: event,
          from_wallet: true,
        })
      );

      // Then log it the 'unified' way:
      if (event.type === "ui-request_pin") {
        this.emit(
          Events.PIN_REQUEST,
          makeEvent({
            message_type: Events.PIN_REQUEST,
            from_wallet: true,
          })
        );
      } else if (event.type === "ui-request_passphrase") {
        this.emit(
          Events.PASSPHRASE_REQUEST,
          makeEvent({
            message_type: Events.PASSPHRASE_REQUEST,
            from_wallet: true,
          })
        );
      } else if (event.type === "ui-request_confirmation") {
        if (event.payload.view == "no-backup") {
          this.emit("NEEDS_BACKUP");
        }
      } else if (event.type === "ui-button") {
        let kind = event.payload.code;
        this.emit(
          Events.BUTTON_REQUEST,
          makeEvent({
            message_type: Events.BUTTON_REQUEST,
            from_wallet: true,
            message: kind,
          })
        );
      }
    });
  }

  public async cancel(): Promise<void> {
    TrezorConnectTransport.callInProgress = undefined;
    await TrezorConnect.cancel();
  }

  public static async callQuiet(
    device: TrezorDevice,
    method: string,
    msg: any,
    msTimeout?: number
  ): Promise<TrezorConnectResponse> {
    // TrezorConnect only lets us make one call at a time. If this library is
    // used in a concurrent environment like say, React, then we need to guard
    // against promises resolving in strange orders. To force an ordering here,
    // and keep wires from getting crossed, we wait for the other call to finish
    // first, if there is one.

    // Notify any other concurrent threads that they need to wait, making sure
    // to clean up after we're done talking to TrezorConnect.
    TrezorConnectTransport.callInProgress = (async () => {
      await TrezorConnectTransport.cancellable(TrezorConnectTransport.callInProgress);

      try {
        let result = await TrezorConnect[method]({ device, ...msg });
        if (
          result.payload.error === "Popup closed" ||
          result.payload.error === "Cancelled" ||
          result.payload.code === "Failure_ActionCancelled"
        )
          throw new ActionCancelled();
        return result;
      } catch (error) {
        if (error.type === HDWalletErrorType.ActionCancelled) {
          throw error;
        }
        console.error("TrezorConnect isn't supposed to throw?", error);
      } finally {
        // Avoid a TrezorConnect bug: https://github.com/trezor/connect/issues/403
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    })();

    // And now we wait on our own results:
    return TrezorConnectTransport.callInProgress;
  }

  public async call(method: string, msg: any, msTimeout?: number): Promise<TrezorConnectResponse> {
    this.emit(
      method,
      makeEvent({
        message_type: method,
        message: this.censor(method, msg),
        from_wallet: false,
      })
    );

    let response = await TrezorConnectTransport.callQuiet(this.device, method, msg, msTimeout);

    this.emit(
      method,
      makeEvent({
        message_type: method,
        message: response,
        from_wallet: true,
      })
    );

    return response;
  }

  /**
   * Keep sensitive data out of logs.
   */
  protected censor(method: string, msg: any): any {
    // TODO:
    // if (debuglink)
    //   return msg

    if (method === "loadDevice") {
      msg.mnemonic = "<redacted>";
      msg.pin = "<redacted>";
    }

    if (method == "uiResponse") {
      if (msg.type == "receive-pin") {
        // The pin is ciphered, but if a user sees the logs they might freak out
        // and think we're logging their actual pin.
        msg.payload = "<redacted>";
      }

      if (msg.type == "receive-passphrase") {
        // Obviously.
        msg.payload.passphrase = "<redacted>";
      }

      if (msg.type == "receive-word") {
        // Censor words, in case the user accidentally enters their seed phrase
        // in order, rather than in the order that the device asks for.
        msg.payload = "<redacted>";
      }
    }

    return msg;
  }
}
