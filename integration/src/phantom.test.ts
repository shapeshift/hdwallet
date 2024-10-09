import { integration } from "./integration";
import * as Phantom from "./wallets/phantom";

jest.spyOn(console, "error").mockImplementation(() => {});

integration(Phantom);
