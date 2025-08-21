import { integration } from "./integration";
import * as Vultisig from "./wallets/vultisig";

describe("Vultisig", () => {
  integration(Vultisig);
});
