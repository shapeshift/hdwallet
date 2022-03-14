import * as core from "@shapeshiftoss/hdwallet-core";
import * as trezor from "@shapeshiftoss/hdwallet-trezor";
import TrezorConnect, { DEVICE, DEVICE_EVENT, UI_EVENT } from "trezor-connect";

export const POPUP = true;

export type TrezorDevice = {
  path: string;
  deviceID: string;
};

export class TrezorConnectTransport extends trezor.TrezorTransport {
  readonly hasPopup = POPUP;
  device: TrezorDevice;

  /// Gobal, shared between all instances of this class, since TrezorConnect only
  /// allows us to make one device call at a time.
  static callInProgress: Promise<any> = Promise.resolve();

  public static async cancellable(inProgress: Promise<any>): Promise<void> {
    try {
      // We throw away the result, since it's either undefined, or meant for the
      // other concurrent thread, possibly involving a different TrezorConnectTransport.
      await inProgress;
    } catch (e) {
      // Unless it's a cancel, throw away the error, as the other context will handle it.
      if (core.isIndexable(e) && e.type === core.HDWalletErrorType.ActionCancelled) {
        TrezorConnectTransport.callInProgress = Promise.resolve();
        throw e;
      }
    }
  }

  constructor(device: TrezorDevice, keyring: core.Keyring) {
    super(keyring);
    this.device = device;
  }

  public async getDeviceID(): Promise<string> {
    return this.device.deviceID;
  }

  public async connect(): Promise<void> {
    TrezorConnect.on(DEVICE_EVENT, (event: any) => {
      if (!this.device.path && event.features && event.path && event.features.device_id === this.device.deviceID) {
        this.device.path = event.path;
      }
    });

    TrezorConnect.on(UI_EVENT, (event: any) => {
      if (!event.payload) return;

      if (!event.payload.device) return;

      if (!event.payload.device.features) return;

      if (this.device.deviceID !== event.payload.device.features.device_id) return;

      // Log TrezorConnect's event raw:
      this.emit(
        event.type,
        core.makeEvent({
          message_type: event.type,
          message: event,
          from_wallet: true,
        })
      );

      // Then log it the 'unified' way:
      if (event.type === DEVICE.PIN) {
        this.emit(
          core.Events.PIN_REQUEST,
          core.makeEvent({
            message_type: core.Events.PIN_REQUEST,
            from_wallet: true,
          })
        );
      } else if (event.type === "ui-request_passphrase") {
        this.emit(
          core.Events.PASSPHRASE_REQUEST,
          core.makeEvent({
            message_type: core.Events.PASSPHRASE_REQUEST,
            from_wallet: true,
          })
        );
      } else if (event.type === "ui-request_confirmation") {
        if (event.payload.view == "no-backup") {
          this.emit("NEEDS_BACKUP");
        }
      } else if (event.type === "ui-button") {
        const kind = event.payload.code;
        this.emit(
          core.Events.BUTTON_REQUEST,
          core.makeEvent({
            message_type: core.Events.BUTTON_REQUEST,
            from_wallet: true,
            message: kind,
          })
        );
      }
    });
  }

  public async cancel(): Promise<void> {
    TrezorConnectTransport.callInProgress = Promise.resolve();
    await TrezorConnect.cancel();
  }

  public static async callQuiet(
    device: TrezorDevice | undefined,
    method: string,
    msg: any
  ): Promise<trezor.TrezorConnectResponse> {
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
        const result = await (TrezorConnect as any)[method]({ device, ...msg });
        if (
          result.payload.error === "Popup closed" ||
          result.payload.error === "Cancelled" ||
          result.payload.code === "Failure_ActionCancelled"
        )
          throw new core.ActionCancelled();
        return result;
      } catch (error) {
        if (core.isIndexable(error) && error.type === core.HDWalletErrorType.ActionCancelled) {
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

  public async call(method: string, msg: any): Promise<trezor.TrezorConnectResponse> {
    this.emit(
      method,
      core.makeEvent({
        message_type: method,
        message: this.censor(method, msg),
        from_wallet: false,
      })
    );

    const response = await TrezorConnectTransport.callQuiet(this.device, method, msg);

    this.emit(
      method,
      core.makeEvent({
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
