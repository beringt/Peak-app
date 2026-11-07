// Keep UTC timestamp fixtures deterministic on every developer machine.
process.env.TZ = "UTC";

module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "CommonJS" } }],
  },
};
