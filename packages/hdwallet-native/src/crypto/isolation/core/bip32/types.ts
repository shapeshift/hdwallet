import { Static } from "funtypes";

import { BoundedString, ByteArray } from "../../types";

const chainCodeBase = ByteArray(32);
export type ChainCode = Static<typeof chainCodeBase>;
const chainCodeStatic = {};
const chainCode = Object.assign(chainCodeBase, chainCodeStatic);
export const ChainCode: typeof chainCode = chainCode;

// This is the same regex that the bip32 library uses to validate paths.
const pathBase = BoundedString(/^((m\/)?(\d+'?\/)*\d+'?)$/);
export type Path = Static<typeof pathBase>;
const pathStatic = {};
const path = Object.assign(pathBase, pathStatic);
export const Path: typeof path = path;
