/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts", "!**/dist/**"],
  coverageDirectory: "<rootDir>/../coverage",
  preset: "ts-jest",
  reporters: ["default", "jest-junit"],
  rootDir: "packages",
  testMatch: ["<rootDir>/**/*.test.ts"],
  transformIgnorePatterns: ["node_modules/(?!(@shapeshiftoss/bitcoinjs-lib|valibot)/.*)"],
  moduleNameMapper: {
    "^@shapeshiftoss/hdwallet-(.*)": "<rootDir>/hdwallet-$1/src",
    "^valibot$": require.resolve("valibot"),
  },
  globals: {
    "ts-jest": {
      diagnostics: {
        ignoreCodes: [7016],
      },
    },
  },
  setupFiles: ["fake-indexeddb/auto"],
};
