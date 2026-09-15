const assert = require('assert');
const { parsePrecoBR } = require('../core/services/supplier-quote-engine/index.js');
const { parsePrecoBR: parsePrecoBRTs } = require('../lib/services/automacao/buscarProduto.ts');

console.log('=== RUNNING UNIT TESTS FOR parsePrecoBR ===\n');

const testCases = [
  { input: 'R$ 45,90', expected: 45.90 },
  { input: 'R$ 1.234,56', expected: 1234.56 },
  { input: 'R$ 12.345,00', expected: 12345.00 },
  { input: '1234,5', expected: 1234.50 },
  { input: ' R$  99,00 ', expected: 99.00 },
  { input: 'R$\u00A099,99', expected: 99.99 },
  { input: '1.250,90', expected: 1250.90 }
];

let passed = 0;
let failed = 0;

for (const { input, expected } of testCases) {
  try {
    const resultJs = parsePrecoBR(input);
    const resultTs = parsePrecoBRTs(input);
    
    assert.strictEqual(resultJs, expected, `JS result mismatch for "${input}"`);
    assert.strictEqual(resultTs, expected, `TS result mismatch for "${input}"`);
    
    console.log(`✓ PASS: "${input}" => ${resultJs}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: "${input}" => ${err.message}`);
    failed++;
  }
}

// Test Error Handling on invalid inputs
const invalidInputs = ['', '   ', 'R$', 'sem estoque', null, undefined];
console.log('\n--- Testing Error Handling on Invalid Inputs ---');

for (const invalidInput of invalidInputs) {
  try {
    parsePrecoBR(invalidInput);
    console.error(`❌ FAIL: Input "${invalidInput}" should have thrown an error!`);
    failed++;
  } catch (err) {
    console.log(`✓ PASS: Input "${invalidInput}" correctly threw error -> "${err.message}"`);
    passed++;
  }
}

console.log(`\n=== TEST SUMMARY: ${passed} PASSED | ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
