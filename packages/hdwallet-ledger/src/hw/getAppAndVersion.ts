import { createCustomErrorClass } from "@ledgerhq/errors";
import Transport from "@ledgerhq/hw-transport";

const GetAppAndVersionUnsupportedFormat = createCustomErrorClass("GetAppAndVersionUnsupportedFormat");

export const getAppAndVersion = async (
  transport: Transport
): Promise<{
  name: string;
  version: string;
  flags: number | Buffer;
}> => {
  const r = await transport.send(0xb0, 0x01, 0x00, 0x00);
  let i = 0;
  const format = r[i++];

  if (format !== 1) {
    throw new GetAppAndVersionUnsupportedFormat("getAppAndVersion: format not supported");
  }

  const nameLength = r[i++];
  const name = r.subarray(i, (i += nameLength)).toString("ascii");
  const versionLength = r[i++];
  const version = r.subarray(i, (i += versionLength)).toString("ascii");
  const flagLength = r[i++];
  const flags = r.subarray(i, (i += flagLength));
  return {
    name,
    version,
    flags,
  };
};
