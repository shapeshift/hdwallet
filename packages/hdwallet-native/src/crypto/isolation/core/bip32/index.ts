export * from "./types";
export * from "./interfaces";

import { Path } from "./types";
import { Node } from "./interfaces";

interface Derivable {
    derive(index: number): Promise<this>
}

export async function derivePath<T extends Derivable>(node: T, path: Path): Promise<T> {
    // This logic is copied (almost) wholesale from the bip32 package.
    Path.assert(path);

    let splitPath = path.split('/');
    if (splitPath[0] === 'm') {
        splitPath = splitPath.slice(1);
    }
    const endIndex = splitPath.lastIndexOf("");
    if (endIndex >= 0) splitPath = splitPath.slice(0, endIndex);
    return await splitPath.reduce(async (prevHd, indexStr) => {
        let index;
        if (indexStr.slice(-1) === `'`) {
            index = parseInt(indexStr.slice(0, -1), 10);
            return (await prevHd).derive(index + 0x80000000);
        }
        else {
            index = parseInt(indexStr, 10);
            return (await prevHd).derive(index);
        }
    }, Promise.resolve(node));
}
