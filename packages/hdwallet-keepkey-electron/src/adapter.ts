import * as keepkey from "@keepkey/hdwallet-keepkey";

import { AdapterDelegateProxy } from "./proxies";

export const Adapter = keepkey.Adapter.fromDelegate(AdapterDelegateProxy);
