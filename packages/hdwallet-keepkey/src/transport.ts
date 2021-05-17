import { Message, BinaryReader } from "google-protobuf";

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
import { SEGMENT_SIZE } from "./utils";

export interface TransportDelegate {
  isOpened(): Promise<boolean>;
  getDeviceID(): Promise<string>;

  connect(): Promise<void>;
  tryConnectDebugLink?(): Promise<boolean>;
  disconnect(): Promise<void>;

  writeChunk(buf: Uint8Array, debugLink?: boolean): Promise<void>;
  readChunk(debugLink?: boolean): Promise<Uint8Array>;
}

export class KeepKeyTransport extends Transport {
  debugLink: boolean;
  userActionRequired: boolean = false;
  delegate: TransportDelegate;

  /// One per transport, unlike on Trezor, since the contention is
  /// only per-device, not global.
  callInProgress: {
    main: Promise<any>;
    debug: Promise<any>;
  } = {
    main: undefined,
    debug: undefined,
  };

  constructor(keyring: Keyring, delegate: TransportDelegate) {
    super(keyring);
    this.delegate = delegate;
  }

  public static async create(keyring: Keyring, delegate: TransportDelegate): Promise<KeepKeyTransport> {
    return new KeepKeyTransport(keyring, delegate);
  }

  public isOpened(): Promise<boolean> {
    return this.delegate.isOpened();
  }
  public getDeviceID(): Promise<string> {
    return this.delegate.getDeviceID();
  }

  public connect(): Promise<void> {
    return this.delegate.connect();
  }
  public async tryConnectDebugLink(): Promise<boolean> {
    let out = false
    if (this.delegate.tryConnectDebugLink && await this.delegate.tryConnectDebugLink()) out = true;
    this.debugLink = out;
    return out;
  }
  public disconnect(): Promise<void> {
    return this.delegate.disconnect();
  }

  private async write(buf: Uint8Array, debugLink: boolean): Promise<void> {
    // break frame into segments
    for (let i = 0; i < buf.length; i += SEGMENT_SIZE) {
      const segment = buf.slice(i, i + SEGMENT_SIZE);
      const padding = new Uint8Array(SEGMENT_SIZE - segment.length);
      const fragments: Array<Uint8Array> = [];
      fragments.push(new Uint8Array([63]));
      fragments.push(segment);
      fragments.push(padding);
      const fragmentBuffer = new Uint8Array(fragments.map((x) => x.length).reduce((a, x) => a + x, 0));
      fragments.reduce((a, x) => (fragmentBuffer.set(x, a), a + x.length), 0);
      await this.delegate.writeChunk(fragmentBuffer, debugLink);
    }
  }

  private async read(debugLink: boolean): Promise<Uint8Array> {
    const first = await this.delegate.readChunk(debugLink);

    // Check that buffer starts with: "?##" [ 0x3f, 0x23, 0x23 ]
    // "?" = USB reportId, "##" = KeepKey magic bytes
    // Message ID is bytes 4-5. Message length starts at byte 6.
    const firstView = new DataView(first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength));
    const valid = (firstView.getUint32(0) & 0xffffff00) === 0x3f232300;
    const msgLength = firstView.getUint32(5);
    if (!valid) throw new Error("message not valid");

    const buffer = new Uint8Array(9 + 2 + msgLength);
    buffer.set(first.slice(0, Math.min(first.length, buffer.length)));

    for (let offset = first.length; offset < buffer.length; ) {
      // Drop USB "?" reportId in the first byte
      let next = (await this.delegate.readChunk(debugLink)).slice(1);
      buffer.set(next.slice(0, Math.min(next.length, buffer.length - offset)), offset);
      offset += next.length;
    }

    return buffer;
  }

  public getVendor(): string {
    return "KeepKey";
  }

  public getEntropy(length: number): Uint8Array {
    if (typeof window !== "undefined" && window?.crypto) {
      return window.crypto.getRandomValues(new Uint8Array(length));
    }
    const { randomBytes } = require("crypto");
    return randomBytes(length);
  }

  public async getFirmwareHash(firmware: Uint8Array): Promise<Uint8Array> {
    if (typeof window !== "undefined" && window?.crypto) {
      return new Uint8Array(await window.crypto.subtle.digest({ name: "SHA-256" }, firmware));
    }
    const { createHash } = require("crypto");
    const hash = createHash("sha256");
    hash.update(firmware);
    return hash.digest();
  }

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

  protected toMessageBuffer(msgTypeEnum: number, msg: Message): Uint8Array {
    const messageBuffer = msg.serializeBinary();

    const headerBuffer = new Uint8Array(8);
    const headerView = new DataView(headerBuffer.buffer);

    headerView.setUint8(0, 0x23);
    headerView.setUint8(1, 0x23);
    headerView.setUint16(2, msgTypeEnum);
    headerView.setUint32(4, messageBuffer.byteLength);

    const fragments = [headerBuffer, messageBuffer];
    const fragmentBuffer = new Uint8Array(fragments.map((x) => x.length).reduce((a, x) => a + x, 0));
    fragments.reduce((a, x) => (fragmentBuffer.set(x, a), a + x.length), 0);
    return fragmentBuffer;
  }

  protected fromMessageBuffer(buf: Uint8Array): [number, Message] {
    const typeID = new DataView(buf.buffer).getUint16(3);
    const MType = messageTypeRegistry[typeID] as any;
    if (!MType) {
      const msg = new Failure();
      msg.setCode(FailureType.FAILURE_UNEXPECTEDMESSAGE);
      msg.setMessage("Unknown message type received");
      return [MessageType.MESSAGETYPE_FAILURE, msg];
    }
    const msg = new MType();
    const reader = new BinaryReader(buf, 9, buf.length - (9 + 2));
    return [typeID, MType.deserializeBinaryFromReader(msg, reader)];
  }

  protected static failureMessageFactory(e?: Error | string): Uint8Array {
    const msg = new Failure();
    msg.setCode(FailureType.FAILURE_UNEXPECTEDMESSAGE);
    if (typeof e === "string") {
      msg.setMessage(e);
    } else {
      msg.setMessage(String(e));
    }
    return msg.serializeBinary();
  }
}
