import { Message, BinaryReader } from "google-protobuf";
import * as ByteBuffer from "bytebuffer";

import {
  Transport,
  takeFirstOfManyEvents,
  makeEvent,
  Event,
  Events,
  DEFAULT_TIMEOUT,
  LONG_TIMEOUT,
  Keyring,
  ActionCancelled,
  HDWalletErrorType,
} from "@shapeshiftoss/hdwallet-core";
import { MessageType, ButtonAck, Cancel, EntropyAck, Failure } from "@keepkey/device-protocol/lib/messages_pb";
import { FailureType } from "@keepkey/device-protocol/lib/types_pb";

import { messageTypeRegistry, messageNameRegistry } from "./typeRegistry";
import { EXIT_TYPES } from "./responseTypeRegistry";

const {
  default: { concat: concatBuffers, wrap },
} = ByteBuffer as any;

export abstract class KeepKeyTransport extends Transport {
  debugLink: boolean;
  userActionRequired: boolean = false;

  /// One per transport, unlike on Trezor, since the contention is
  /// only per-device, not global.
  callInProgress: {
    main: Promise<any>;
    debug: Promise<any>;
  } = {
    main: undefined,
    debug: undefined,
  };

  constructor(keyring: Keyring) {
    super(keyring);
  }

  public abstract getDeviceID(): Promise<string>;
  public abstract getVendor(): string;
  public abstract isOpened(): Promise<boolean>;

  public abstract disconnect(): Promise<void>;
  public abstract getEntropy(length: number): Uint8Array;
  public abstract getFirmwareHash(firmware: any): Promise<any>;

  protected abstract write(buff: ByteBuffer, debugLink: boolean): Promise<void>;
  protected abstract read(debugLink: boolean): Promise<ByteBuffer>;

  /**
   * Utility function to cancel all pending calls whenver one of them is cancelled.
   */
  public async cancellable(inProgress: Promise<any>): Promise<void> {
    try {
      await inProgress;
    } catch (e) {
      // Throw away the error, as the other context will handle it,
      // unless it was a cancel, in which case we cancel everything.
      if (e.type === HDWalletErrorType.ActionCancelled) {
        this.callInProgress = { main: undefined, debug: undefined };
        throw e;
      }
    }
  }

  public async lockDuring<T>(action: () => Promise<T>): Promise<T> {
    this.callInProgress.main = (async () => {
      await this.cancellable(this.callInProgress.main);
      return action();
    })();
    return this.callInProgress.main;
  }

  public async handleCancellableResponse(messageType: any) {
    const event = (await takeFirstOfManyEvents(this, [String(messageType), ...EXIT_TYPES]).toPromise()) as Event;
    return this.readResponse(false);
  }

  public async readResponse(debugLink: boolean): Promise<Event> {
    let buf;
    do {
      buf = await this.read(debugLink);
    } while (!buf);
    const [msgTypeEnum, msg] = this.fromMessageBuffer(buf);
    let event = makeEvent({
      message_type: messageNameRegistry[msgTypeEnum],
      message_enum: msgTypeEnum,
      message: msg.toObject(),
      proto: msg,
      from_wallet: true,
    });
    this.emit(String(msgTypeEnum), event);

    if (debugLink) return event;

    if (msgTypeEnum === MessageType.MESSAGETYPE_FAILURE) {
      const failureEvent = makeEvent({
        message_type: Events.FAILURE,
        message_enum: msgTypeEnum,
        message: msg.toObject(),
        from_wallet: true,
      });
      this.emit(Events.FAILURE, failureEvent);
      return failureEvent;
    }

    if (msgTypeEnum === MessageType.MESSAGETYPE_BUTTONREQUEST) {
      this.emit(
        Events.BUTTON_REQUEST,
        makeEvent({
          message_type: Events.BUTTON_REQUEST,
          from_wallet: true,
        })
      );
      this.userActionRequired = true;
      return this.call(MessageType.MESSAGETYPE_BUTTONACK, new ButtonAck(), LONG_TIMEOUT, true, false);
    }

    if (msgTypeEnum === MessageType.MESSAGETYPE_ENTROPYREQUEST) {
      const ack = new EntropyAck();
      ack.setEntropy(this.getEntropy(32));
      return this.call(MessageType.MESSAGETYPE_ENTROPYACK, ack, LONG_TIMEOUT, true, false);
    }

    if (msgTypeEnum === MessageType.MESSAGETYPE_PINMATRIXREQUEST) {
      this.emit(
        Events.PIN_REQUEST,
        makeEvent({
          message_type: Events.PIN_REQUEST,
          from_wallet: true,
        })
      );
      this.userActionRequired = true;
      return this.handleCancellableResponse(MessageType.MESSAGETYPE_PINMATRIXACK);
    }

    if (msgTypeEnum === MessageType.MESSAGETYPE_PASSPHRASEREQUEST) {
      this.emit(
        Events.PASSPHRASE_REQUEST,
        makeEvent({
          message_type: Events.PASSPHRASE_REQUEST,
          from_wallet: true,
        })
      );
      this.userActionRequired = true;
      return this.handleCancellableResponse(MessageType.MESSAGETYPE_PASSPHRASEACK);
    }

    if (msgTypeEnum === MessageType.MESSAGETYPE_CHARACTERREQUEST) {
      this.emit(
        Events.CHARACTER_REQUEST,
        makeEvent({
          message_type: Events.CHARACTER_REQUEST,
          from_wallet: true,
        })
      );
      this.userActionRequired = true;
      return this.handleCancellableResponse(MessageType.MESSAGETYPE_CHARACTERACK);
    }

    if (msgTypeEnum === MessageType.MESSAGETYPE_WORDREQUEST) {
      this.emit(
        Events.WORD_REQUEST,
        makeEvent({
          message_type: Events.WORD_REQUEST,
          from_wallet: true,
        })
      );
      this.userActionRequired = true;
      return this.handleCancellableResponse(MessageType.MESSAGETYPE_WORDACK);
    }

    return event;
  }

  public async call(
    msgTypeEnum: number,
    msg: Message,
    msgTimeout: number = DEFAULT_TIMEOUT,
    omitLock: boolean = false,
    noWait: boolean = false
  ): Promise<any> {
    this.emit(
      String(msgTypeEnum),
      makeEvent({
        message_type: messageNameRegistry[msgTypeEnum],
        message_enum: msgTypeEnum,
        message: msg.toObject(),
        proto: msg,
        from_wallet: false,
      })
    );

    let makePromise = async () => {
      if (
        ([
          MessageType.MESSAGETYPE_BUTTONACK,
          MessageType.MESSAGETYPE_PASSPHRASEACK,
          MessageType.MESSAGETYPE_CHARACTERACK,
          MessageType.MESSAGETYPE_PINMATRIXACK,
          MessageType.MESSAGETYPE_WORDACK,
        ] as Array<number>).includes(msgTypeEnum)
      ) {
        this.userActionRequired = true;
      }
      await this.write(this.toMessageBuffer(msgTypeEnum, msg), false);

      if (!noWait) {
        const response = await this.readResponse(false);
        this.userActionRequired = false;
        if (
          response.message_enum === MessageType.MESSAGETYPE_FAILURE &&
          response.message.code === FailureType.FAILURE_ACTIONCANCELLED
        ) {
          this.callInProgress = { main: undefined, debug: undefined };
          throw new ActionCancelled();
        }
        return response;
      }
    };

    if (!omitLock) {
      // See the comments in hdwallet-trezor-connect's call for why this weird
      // sequence. We've got a very similar issue here that needs pretty much
      // the same solution.
      this.callInProgress.main = (async () => {
        await this.cancellable(this.callInProgress.main);

        try {
          return makePromise();
        } finally {
          this.userActionRequired = false;
        }
      })();

      return await this.callInProgress.main;
    } else {
      return makePromise();
    }
  }

  public async callDebugLink(
    msgTypeEnum: number,
    msg: Message,
    msgTimeout: number = DEFAULT_TIMEOUT,
    omitLock: boolean = false,
    noWait: boolean = false
  ): Promise<any> {
    this.emit(
      String(msgTypeEnum),
      makeEvent({
        message_type: messageNameRegistry[msgTypeEnum],
        message_enum: msgTypeEnum,
        message: msg.toObject(),
        proto: msg,
        from_wallet: false,
      })
    );

    let makePromise = async () => {
      await this.write(this.toMessageBuffer(msgTypeEnum, msg), true);
      if (!noWait) return this.readResponse(true);
    };

    if (!omitLock) {
      this.callInProgress.debug = (async () => {
        await this.cancellable(this.callInProgress.debug);
        return makePromise();
      })();

      return await this.callInProgress.debug;
    } else {
      return makePromise();
    }
  }

  public async cancel() {
    if (!this.userActionRequired) return;
    try {
      this.callInProgress = { main: undefined, debug: undefined };
      const cancelMsg = new Cancel();
      await this.call(MessageType.MESSAGETYPE_CANCEL, cancelMsg, DEFAULT_TIMEOUT, false, this.userActionRequired);
    } catch (e) {
      console.error("Cancel Pending Error", e);
    } finally {
      this.callInProgress = { main: undefined, debug: undefined };
    }
  }

  protected toMessageBuffer(msgTypeEnum: number, msg: Message): ByteBuffer {
    const messageBuffer = msg.serializeBinary();

    const headerBuffer = new ArrayBuffer(8);
    const headerView = new DataView(headerBuffer);

    headerView.setUint8(0, 0x23);
    headerView.setUint8(1, 0x23);
    headerView.setUint16(2, msgTypeEnum);
    headerView.setUint32(4, messageBuffer.byteLength);

    return concatBuffers([headerView.buffer, messageBuffer]);
  }

  protected fromMessageBuffer(bb: ByteBuffer): [number, Message] {
    const typeID = bb.readUint16(3);
    const MType = messageTypeRegistry[typeID] as any;
    if (!MType) {
      const msg = new Failure();
      msg.setCode(FailureType.FAILURE_UNEXPECTEDMESSAGE);
      msg.setMessage("Unknown message type received");
      return [MessageType.MESSAGETYPE_FAILURE, msg];
    }
    const msg = new MType();
    const reader = new BinaryReader(bb.toBuffer(), 9, bb.limit - (9 + 2));
    return [typeID, MType.deserializeBinaryFromReader(msg, reader)];
  }

  protected static failureMessageFactory(e?: Error | string) {
    const msg = new Failure();
    msg.setCode(FailureType.FAILURE_UNEXPECTEDMESSAGE);
    if (typeof e === "string") {
      msg.setMessage(e);
    } else {
      msg.setMessage(String(e));
    }
    return wrap(msg.serializeBinary());
  }
}
