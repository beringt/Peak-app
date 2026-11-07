import { parseWeight } from "./weight";

test.each(["", " ", "0", "-1", "500.1", "NaN", "Infinity", "-Infinity", "abc", "80kg", "80,2,3"])(
  "rejects invalid weight %j", (input) => expect(parseWeight(input)).toBeNull()
);

test.each([
  { input: "80", expected: 80 },
  { input: " 80.5 ", expected: 80.5 },
  { input: "80,5", expected: 80.5 },
  { input: "500", expected: 500 },
  { input: "0.1", expected: 0.1 },
])("accepts $input kg", ({ input, expected }) => expect(parseWeight(input)).toBe(expected));
