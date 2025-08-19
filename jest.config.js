/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts", "!**/dist/**"],
  coverageDirectory: "<rootDir>/../coverage",
  preset: "ts-jest",
  reporters: ["default", "jest-junit"],
  rootDir: "packages",
  testMatch: ["<rootDir>/**/*.test.ts"],
  transformIgnorePatterns: ["node_modules/(?!(@shapeshiftoss/bitcoinjs-lib|valibot|axios|@shapeshiftoss/caip)/.*)"],
  moduleNameMapper: {
    "^@shapeshiftoss/hdwallet-(.*)": "<rootDir>/hdwallet-$1/src",
    "^valibot$": require.resolve("valibot"),
    "^axios$": "<rootDir>/hdwallet-vultisig/src/__mocks__/axios.ts",
  },
  globals: {
    "ts-jest": {
      diagnostics: {
        ignoreCodes: [7016, 2416, 2345, 2322, 2769],
      },
    },
  },
  setupFiles: ["fake-indexeddb/auto"],
};
