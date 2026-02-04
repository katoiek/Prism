
import { extractDataArray } from './jsonUtils'

const testCases = [
	{
		name: "Single Object (No Arrays)",
		input: { id: 1, name: "Test" },
		expected: [{ id: 1, name: "Test" }]
	},
	{
		name: "Single Object with One Array (Tags)",
		input: { id: 1, name: "Test", tags: ["a", "b"] },
		expected: [{ id: 1, name: "Test", tags: ["a", "b"] }]
	},
	{
		name: "Wrapped Array (Standard)",
		input: { meta: { page: 1 }, users: [{ id: 1 }, { id: 2 }] },
		expected: [{ id: 1 }, { id: 2 }]
	},
	{
		name: "Custom Wrapper (No ID)",
		input: { meta: "info", custom_list: ["x", "y"] },
		expected: ["x", "y"]
	}
];

testCases.forEach(tc => {
	const result = extractDataArray(tc.input);
	console.log(`--- ${tc.name} ---`);
	console.log("Input:", JSON.stringify(tc.input));
	console.log("Result:", JSON.stringify(result));
	const isExpected = JSON.stringify(result) === JSON.stringify(tc.expected);
	console.log("Pass:", isExpected);
	if (!isExpected) console.log("EXPECTED:", JSON.stringify(tc.expected));
});
