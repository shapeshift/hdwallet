import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as BinanceMessages from "@keepkey/device-protocol/lib/messages-binance_pb";
import * as CosmosMessages from "@keepkey/device-protocol/lib/messages-cosmos_pb";
import * as EosMessages from "@keepkey/device-protocol/lib/messages-eos_pb";
import * as NanoMessages from "@keepkey/device-protocol/lib/messages-nano_pb";
import * as RippleMessages from "@keepkey/device-protocol/lib/messages-ripple_pb";
import * as ThorchainMessages from "@keepkey/device-protocol/lib/messages-thorchain_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as jspb from "google-protobuf";
import _ from "lodash";

// Conflict between typedef and actual js export

const AllMessages = ([] as Array<[string, core.Constructor<jspb.Message>]>)
  .concat(Object.entries(_.omit(Messages, "MessageType", "MessageTypeMap")))
  .concat(Object.entries(CosmosMessages))
  .concat(Object.entries(BinanceMessages))
  .concat(Object.entries(RippleMessages))
  .concat(Object.entries(NanoMessages))
  .concat(Object.entries(_.omit(EosMessages, "EosPublicKeyKind", "EosPublicKeyKindMap")))
  .concat(Object.entries(ThorchainMessages));

const upperCasedMessageClasses = AllMessages.reduce((registry, entry: [string, core.Constructor<jspb.Message>]) => {
  registry[entry[0].toUpperCase()] = entry[1];
  return registry;
}, {} as Record<string, core.Constructor<jspb.Message>>);

// Map of message type enums to human readable message name
export const messageNameRegistry = Object.entries(Messages.MessageType).reduce((registry, entry: [string, number]) => {
  registry[entry[1]] = entry[0].split("_")[1];
  return registry;
}, {} as Record<number, string>);

// Map of message type enum to their protobuf constructor
export const messageTypeRegistry = Object.entries(Messages.MessageType).reduce((registry, entry: [string, number]) => {
  registry[entry[1]] = upperCasedMessageClasses[entry[0].split("_")[1].toUpperCase()];
  return registry;
}, {} as Record<number, core.Constructor<jspb.Message>>);
