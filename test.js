const assert = require('assert');
const vm = require('vm');
const workflow = require('./workflows/ai-lead-qualification.json');
const { normalizeLead } = require('./src/normalizeLead');
const { parseQualification } = require('./src/parseQualification');

const lead = normalizeLead({ name: ' Priya ', email: 'Priya@Acme.io ', message: 'Need our Shopify orders synced to Sheets', budget: '$500' });
assert.strictEqual(lead.email, 'priya@acme.io');
assert.strictEqual(lead.name, 'Priya');
assert.throws(() => normalizeLead({ email: 'not-an-email', message: 'hi' }), /valid email/);
assert.throws(() => normalizeLead({ email: 'a@b.co' }), /message/);

const ai = { choices: [{ message: { content: JSON.stringify({ score: 8.6, summary: 'Wants order sync', next_step: 'Book a call' }) } }] };
const q = parseQualification(ai, lead);
assert.strictEqual(q.score, 9);
assert.strictEqual(q.category, 'hot');
assert.strictEqual(q.aiParsed, true);

const broken = parseQualification({ choices: [{ message: { content: 'not json' } }] }, lead);
assert.strictEqual(broken.score, 0);
assert.strictEqual(broken.category, 'cold');
assert.strictEqual(broken.aiParsed, false);

// Workflow wiring: every connection points at a real node, and every node except the trigger has an input.
const names = new Set(workflow.nodes.map((n) => n.name));
const targets = new Set();
for (const [from, { main }] of Object.entries(workflow.connections)) {
  assert.ok(names.has(from), `Unknown source node: ${from}`);
  for (const branch of main) for (const c of branch) {
    assert.ok(names.has(c.node), `Unknown target node: ${c.node}`);
    targets.add(c.node);
  }
}
for (const n of workflow.nodes) {
  if (n.type !== 'n8n-nodes-base.webhook') assert.ok(targets.has(n.name), `${n.name} has no input`);
}

// Run the exact jsCode embedded in each Code node, the way n8n's Code node wraps it.
function runCodeNode(name, ctx) {
  const node = workflow.nodes.find((n) => n.name === name);
  return vm.runInNewContext(`(function(){${node.parameters.jsCode}\n})()`, ctx);
}
const normalized = runCodeNode('Normalize lead', { $json: { body: { email: 'ops@shop.com', message: 'Automate refunds' } } }).json;
assert.strictEqual(normalized.email, 'ops@shop.com');
const parsed = runCodeNode('Parse AI result', { $json: ai, $: () => ({ item: { json: normalized } }) }).json;
assert.strictEqual(parsed.category, 'hot');
assert.strictEqual(parsed.email, 'ops@shop.com');

console.log('All tests passed.');
