import { getVersion, PROVIDERS } from "@ledgerhq/device-core";
import { createCustomErrorClass, DeviceOnDashboardExpected, TransportStatusError } from "@ledgerhq/errors";
import Transport from "@ledgerhq/hw-transport";
import { LocalTracer, log } from "@ledgerhq/logs";

import { getAppAndVersion } from "./getAppAndVersion";

const ManagerAllowedFlag = 0x08;
const PinValidatedFlag = 0x80;

const DeviceNotOnboarded = createCustomErrorClass("DeviceNotOnboarded");

type DeviceInfo = {
  mcuVersion: string;
  // the raw mcu version
  version: string;
  // the version part, without the -osu
  majMin: string;
  // the x.y part of the x.y.z-v version
  targetId: string | number;
  // a technical id
  isBootloader: boolean;
  isRecoveryMode?: boolean;
  isOSU: boolean;
  providerName: string | null | undefined;
  managerAllowed: boolean;
  pinValidated: boolean;
  // more precised raw versions
  seVersion?: string;
  mcuBlVersion?: string;
  mcuTargetId?: number;
  seTargetId?: number;
  onboarded?: boolean;
  hasDevFirmware?: boolean;
  bootloaderVersion?: string;
  hardwareVersion?: number;
  languageId?: number;
  seFlags: Buffer;
  charonState?: Buffer;
};

const dashboardNames = ["BOLOS", "OLOS\u0000"];
const isDashboardName = (name: string) => dashboardNames.includes(name);

const isDevFirmware = (seVersion: string | undefined): boolean => {
  if (!seVersion) return false;

  const knownDevSuffixes = ["lo", "rc", "il", "tr"]; // FW can't guarantee non digits in versions
  return knownDevSuffixes.some((suffix) => seVersion.includes("-" + suffix));
};

export const getDeviceInfo = async (transport: Transport): Promise<DeviceInfo> => {
  const tracer = new LocalTracer("hw", {
    ...transport.getTraceContext(),
    function: "getDeviceInfo",
  });
  tracer.trace("Starting get device info");

  const probablyOnDashboard = await getAppAndVersion(transport)
    .then(({ name }) => isDashboardName(name))
    .catch((e) => {
      tracer.trace(`Error from getAppAndVersion: ${e}`, { error: e });
      if (e instanceof TransportStatusError) {
        if (e.statusCode === 0x6e00) {
          return true;
        }

        if (e.statusCode === 0x6d00) {
          return false;
        }
      }

      throw e;
    });

  if (!probablyOnDashboard) {
    tracer.trace(`Device not on dashboard`);
    throw new DeviceOnDashboardExpected();
  }

  const res = await getVersion(transport).catch((e) => {
    tracer.trace(`Error from getVersion: ${e}`, { error: e });
    if (e instanceof TransportStatusError) {
      if (e.statusCode === 0x6d06 || e.statusCode === 0x6d07) {
        throw new DeviceNotOnboarded();
      }
    }
    throw e;
  });

  const {
    isBootloader,
    rawVersion,
    targetId,
    seVersion,
    seTargetId,
    mcuBlVersion,
    mcuVersion,
    mcuTargetId,
    bootloaderVersion,
    hardwareVersion,
    languageId,
    charonState,
    flags,
  } = res;
  const isOSU = rawVersion.includes("-osu");
  const version = rawVersion.replace("-osu", "");
  const m = rawVersion.match(/([0-9]+.[0-9]+(.[0-9]+){0,1})?(-(.*))?/);
  const [, majMin, , , postDash] = m || [];
  const providerName = PROVIDERS[postDash] ? postDash : null;
  const flag = flags.length > 0 ? flags[0] : 0;
  const managerAllowed = !!(flag & ManagerAllowedFlag);
  const pinValidated = !!(flag & PinValidatedFlag);

  let isRecoveryMode = false;
  let onboarded = true;
  if (flags.length === 4) {
    // Nb Since LNS+ unseeded devices are visible + extra flags
    isRecoveryMode = !!(flags[0] & 0x01);
    onboarded = !!(flags[0] & 0x04);
  }

  log(
    "hw",
    "deviceInfo: se@" + version + " mcu@" + mcuVersion + (isOSU ? " (osu)" : isBootloader ? " (bootloader)" : "")
  );

  const hasDevFirmware = isDevFirmware(seVersion);

  return {
    version,
    mcuVersion,
    seVersion,
    mcuBlVersion,
    majMin,
    providerName: providerName || null,
    targetId,
    hasDevFirmware,
    seTargetId,
    mcuTargetId,
    isOSU,
    isBootloader,
    isRecoveryMode,
    managerAllowed,
    pinValidated,
    onboarded,
    bootloaderVersion,
    hardwareVersion,
    languageId,
    charonState,
    seFlags: flags,
  };
};
