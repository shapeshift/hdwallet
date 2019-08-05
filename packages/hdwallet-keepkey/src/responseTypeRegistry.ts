import * as ProtoMessages from '@keepkey/device-protocol/lib/messages_pb'

const { default: { MessageType } } = ProtoMessages as any // Conflict between typedef and actual js export

export const EXIT_TYPES = [
  String(MessageType.MESSAGETYPE_SUCCESS),
  String(MessageType.MESSAGETYPE_CANCEL),
  String(MessageType.MESSAGETYPE_FAILURE)
]

export function getAnticipatedResponseTypes(msgTypeEnum: number) {
  return responseTypeRegistry[msgTypeEnum] || EXIT_TYPES
}

export const responseTypeRegistry = {
  [MessageType.MESSAGETYPE_INITIALIZE]: [
    String(MessageType.MESSAGETYPE_FEATURES),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_GETFEATURES]: [
    String(MessageType.MESSAGETYPE_FEATURES),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_GETCOINTABLE]: [
    String(MessageType.MESSAGETYPE_COINTABLE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_CLEARSESSION]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_APPLYSETTINGS]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_CHANGEPIN]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_PING]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_BUTTONREQUEST]: [
    String(MessageType.MESSAGETYPE_BUTTONACK),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_PINMATRIXREQUEST]: [
    String(MessageType.MESSAGETYPE_PINMATRIXACK),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_PASSPHRASEREQUEST]: [
    String(MessageType.MESSAGETYPE_PASSPHRASEACK),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_GETENTROPY]: [
    String(MessageType.MESSAGETYPE_ENTROPY),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_GETPUBLICKEY]: [
    String(MessageType.MESSAGETYPE_PUBLICKEY),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_GETADDRESS]: [
    String(MessageType.MESSAGETYPE_ADDRESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ETHEREUMGETADDRESS]: [
    String(MessageType.MESSAGETYPE_ETHEREUMADDRESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_WIPEDEVICE]: [
    String(MessageType.MESSAGETYPE_BUTTONREQUEST)
  ],
  [MessageType.MESSAGETYPE_LOADDEVICE]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_RESETDEVICE]: [
    String(MessageType.MESSAGETYPE_ENTROPYREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ENTROPYREQUEST]: [
    String(MessageType.MESSAGETYPE_ENTROPYACK),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ENTROPYACK]: [
    String(MessageType.MESSAGETYPE_BUTTONREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_RECOVERYDEVICE]: [
    String(MessageType.MESSAGETYPE_WORDREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_WORDACK]: [
    String(MessageType.MESSAGETYPE_WORDREQUEST),
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_CHARACTERACK]: [
    String(MessageType.MESSAGETYPE_CHARACTEREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_SIGNMESSAGE]: [
    String(MessageType.MESSAGETYPE_MESSAGESIGNATURE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_VERIFYMESSAGE]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ENCRYPTMESSAGE]: [
    String(MessageType.MESSAGETYPE_ENCRYPTEDMESSAGE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_DECRYPTMESSAGE]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_CIPHERKEYVALUE]: [
    String(MessageType.MESSAGETYPE_CIPHEREDKEYVALUE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ESTIMATETXSIZE]: [
    String(MessageType.MESSAGETYPE_TXSIZE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_SIGNTX]: [
    String(MessageType.MESSAGETYPE_TXREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_TXACK]: [
    String(MessageType.MESSAGETYPE_TXREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_RAWTXACK]: [
    String(MessageType.MESSAGETYPE_TXREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ETHEREUMSIGNTX]: [
    String(MessageType.MESSAGETYPE_ETHEREUMTXREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ETHEREUMTXREQUEST]: [
    String(MessageType.MESSAGETYPE_ETHEREUMTXACK),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ETHEREUMTXACK]: [
    String(MessageType.MESSAGETYPE_ETHEREUMTXREQUEST)
  ],
  [MessageType.MESSAGETYPE_ETHEREUMSIGNMESSAGE]: [
    String(MessageType.MESSAGETYPE_ETHEREUMMESSAGESIGNATURE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ETHEREUMVERIFYMESSAGE]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_ETHEREUMMESSAGESIGNATURE]: [
    String(MessageType.MESSAGETYPE_FEATURES),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_SIGNIDENTITY]: [
    String(MessageType.MESSAGETYPE_SIGNEDIDENTIY),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_APPLYPOLICIES]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_FLASHHASH]: [
    String(MessageType.MESSAGETYPE_FLASHHASHRESPONSE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_FLASHWRITE]: [
    String(MessageType.MESSAGETYPE_FLASHHASHRESPONSE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_DEBUGLINKFLASHDUMP]: [
    String(MessageType.MESSAGETYPE_DEBUGLINKFLASHDUMPRESPONSE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_FIRMWAREERASE]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_FIRMWAREUPLOAD]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_DEBUGLINKDECISION]: [
    String(MessageType.MESSAGETYPE_SUCCESS),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_DEBUGLINKGETSTATE]: [
    String(MessageType.MESSAGETYPE_DEBUGLINKSTATE),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_EOSGETPUBLICKEY]: [
    String(MessageType.MESSAGETYPE_EOSPUBLICKEY),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_EOSSIGNTX]: [
    String(MessageType.MESSAGETYPE_EOSTXACTIONREQUEST),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_EOSTXACTIONREQUEST]: [
    String(MessageType.MESSAGETYPE_EOSTXACTIONACK),
    ...EXIT_TYPES
  ],
  [MessageType.MESSAGETYPE_EOSTXACTIONACK]: [
    String(MessageType.MESSAGETYPE_EOSTXACTIONREQUEST),
    String(MessageType.MESSAGETYPE_EOSSIGNEDTX),
    ...EXIT_TYPES
  ]
}