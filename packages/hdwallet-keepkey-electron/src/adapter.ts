import { KeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey";
import { AdapterDelegateProxy } from "./proxies";

export const ElectronKeepKeyAdapter = KeepKeyAdapter.withDelegate(AdapterDelegateProxy);
