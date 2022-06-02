/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts", "!**/dist/**"],
  coverageDirectory: "<rootDir>/../coverage",
  preset: "ts-jest",
  reporters: ["default", "jest-junit"],
  rootDir: "packages",
  testMatch: ["<rootDir>/**/*.test.ts"],
  moduleNameMapper: {
    "^@shapeshiftoss/hdwallet-(.*)": "<rootDir>/hdwallet-$1/src",
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
