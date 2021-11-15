/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testPathIgnorePatterns: ["dist"],
  setupFiles: ["fake-indexeddb/auto"],
};
