import { CLA, ErrorCode, errorCodeToString, INS, PAYLOAD_TYPE, processErrorResponse } from "./common";

const signSendChunkv1 = async (app: any, chunkIdx: any, chunkNum: any, chunk: any) => {
  return app.transport
    .send(CLA, INS.SIGN_SECP256K1, chunkIdx, chunkNum, chunk, [ErrorCode.NoError, 0x6984, 0x6a80])
    .then((response: any) => {
      const errorCodeData = response.slice(-2);
      const returnCode = errorCodeData[0] * 256 + errorCodeData[1];
      let errorMessage = errorCodeToString(returnCode);

      if (returnCode === 0x6a80 || returnCode === 0x6984) {
        errorMessage = `${errorMessage} : ${response.slice(0, response.length - 2).toString("ascii")}`;
      }

      let signature = null;
      if (response.length > 2) {
        signature = response.slice(0, response.length - 2);
      }

      return {
        signature,
        return_code: returnCode,
        error_message: errorMessage,
      };
    }, processErrorResponse);
};

export const serializePathv2 = (path: Array<number>) => {
  if (!path || path.length !== 5) {
    throw new Error("Invalid path.");
  }

  const buf = Buffer.alloc(20);
  buf.writeUInt32LE(path[0], 0);
  buf.writeUInt32LE(path[1], 4);
  buf.writeUInt32LE(path[2], 8);
  buf.writeUInt32LE(path[3], 12);
  buf.writeUInt32LE(path[4], 16);

  return buf;
};

export const signSendChunkv2 = async (app: any, chunkIdx: any, chunkNum: any, chunk: any) => {
  let payloadType = PAYLOAD_TYPE.ADD;
  if (chunkIdx === 1) {
    payloadType = PAYLOAD_TYPE.INIT;
  }
  if (chunkIdx === chunkNum) {
    payloadType = PAYLOAD_TYPE.LAST;
  }

  return signSendChunkv1(app, payloadType, 0, chunk);
};

export const publicKeyv2 = async (app: any, data: any) => {
  return app.transport.send(CLA, INS.GET_ADDR_SECP256K1, 0, 0, data, [ErrorCode.NoError]).then((response: any) => {
    const errorCodeData = response.slice(-2);
    const returnCode = errorCodeData[0] * 256 + errorCodeData[1];
    const compressedPk = Buffer.from(response.slice(0, 33));

    return {
      pk: "OBSOLETE PROPERTY",
      compressed_pk: compressedPk,
      return_code: returnCode,
      error_message: errorCodeToString(returnCode),
    };
  }, processErrorResponse);
};
