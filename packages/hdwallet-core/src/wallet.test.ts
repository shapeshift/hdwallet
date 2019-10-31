import {
    infoBTC,
    infoETH,
    supportsBTC,
    supportsETH,
    supportsDebugLink
} from './wallet'

describe("wallet : supportsETH", () => {
    it("should return falsy for `null`", () => {
        [
            infoBTC,
            infoETH,
            supportsBTC,
            supportsETH,
            supportsDebugLink
        ].forEach(method => {
            expect(method(undefined)).toBeFalsy()
            expect(method(null)).toBeFalsy()
            expect(method({})).toBeFalsy()
        })
    })
})
