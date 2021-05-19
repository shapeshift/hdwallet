import type * as jspb from "google-protobuf";

export interface Event {
  message_type?: string;
  message_enum?: number;
  from_wallet: boolean;
  wallet_id?: string;
  interface?: string;
  message?: any;
  proto?: jspb.Message;
  date?: number;
}

export enum Events {
  BUTTON_REQUEST = "BUTTON_REQUEST",
  CANCEL = "CANCEL",
  CHARACTER_REQUEST = "CHARACTER_REQUEST",
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  FAILURE = "FAILURE",
  PASSPHRASE_REQUEST = "PASSPHRASE_REQUEST",
  PIN_REQUEST = "PIN_REQUEST",
  SUCCESS = "SUCCESS",
  WORD_REQUEST = "WORD_REQUEST",
}

export function makeEvent(e: Event): Event {
  return {
    date: Date.now(),
    ...e,
  };
}
