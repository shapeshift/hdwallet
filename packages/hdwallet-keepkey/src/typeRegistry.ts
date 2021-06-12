import * as BinanceMessages from "@keepkey/device-protocol/lib/messages-binance_pb";
import * as CosmosMessages from "@keepkey/device-protocol/lib/messages-cosmos_pb";
import * as EosMessages from "@keepkey/device-protocol/lib/messages-eos_pb";
import * as NanoMessages from "@keepkey/device-protocol/lib/messages-nano_pb";
import * as RippleMessages from "@keepkey/device-protocol/lib/messages-ripple_pb";
import * as ThorchainMessages from "@keepkey/device-protocol/lib/messages-thorchain_pb"
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as jspb from "google-protobuf";

// Conflict between typedef and actual js export

const AllMessages = []
  .concat(Object.entries(Messages))
  .concat(Object.entries(CosmosMessages))
  .concat(Object.entries(BinanceMessages))
  .concat(Object.entries(RippleMessages))
  .concat(Object.entries(NanoMessages))
  .concat(Object.entries(EosMessages))
  .concat(Object.entries(ThorchainMessages));

const upperCasedMessageClasses: {
  [msgTypeEnum: number]: any;
} = AllMessages.reduce((registry, entry: [string, jspb.Message]) => {
  registry[entry[0].toUpperCase()] = entry[1];
  return registry;
});

// Map of message type enums to human readable message name
export const messageNameRegistry: {
  [msgTypeEnum: number]: string;
} = Object.entries(Messages.MessageType).reduce((registry, entry: [string, number]) => {
  registry[entry[1]] = entry[0].split("_")[1];
  return registry;
}, {});

// Map of message type enum to their protobuf constructor
export const messageTypeRegistry: {
  [msgTypeEnum: number]: jspb.Message;
} = Object.entries(Messages.MessageType).reduce((registry, entry: [string, number]) => {
  registry[entry[1]] = upperCasedMessageClasses[entry[0].split("_")[1].toUpperCase()];
  return registry;
}, {});
