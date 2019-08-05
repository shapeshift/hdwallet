module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: [ 'default', 'jest-junit' ],
  moduleNameMapper: {
    "^@shapeshift/(.*)": "<rootDir>/packages/$1/dist/index.umd.js"
  }
};
