import {
    infoBTC,
    infoETH,
    supportsBTC,
    supportsETH,
    supportsDebugLink
} from './wallet'

describe("wallet : guards", () => {
    it.each([
        infoBTC,
        infoETH,
        supportsBTC,
        supportsETH,
        supportsDebugLink])
    (
        'should return falsy for `null`',
        (method) => {
            expect(method(undefined)).toBeFalsy()
            expect(method(null)).toBeFalsy()
            expect(method({})).toBeFalsy()
        }
    )
})
