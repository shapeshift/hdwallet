import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { AdapterDelegateProxy } from "./proxies";

export const Adapter = keepkey.Adapter.fromDelegate(AdapterDelegateProxy);
