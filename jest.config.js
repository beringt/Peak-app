module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "CommonJS" } }],
  },
};
