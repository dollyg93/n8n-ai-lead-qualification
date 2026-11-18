// Generates workflows/ai-lead-qualification.json so the n8n Code nodes run the same
// functions that test.js exercises.
const fs = require('fs');
const path = require('path');
const { normalizeLead } = require('./src/normalizeLead');
const { parseQualification } = require('./src/parseQualification');

const SYSTEM_PROMPT = [
  'You qualify inbound sales leads for a small software/automation agency.',
  'Respond with strict JSON: {"score": 0-10, "category": "hot"|"warm"|"cold",',
  '"summary": "one sentence on what they need", "next_step": "recommended follow-up"}.',
  'Score higher for a clear problem, a stated budget or timeline, and a business email.',
].join(' ');

const normalizeCode = `${normalizeLead.toString()}\n\nreturn { json: normalizeLead($json.body) };`;
const parseCode = `${parseQualification.toString()}\n\nreturn { json: parseQualification($json, $('Normalize lead').item.json) };`;

const aiBody = `={{ JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: ${JSON.stringify(SYSTEM_PROMPT)} }, { role: 'user', content: JSON.stringify($json) } ] }) }}`;

const slackBody = "={{ JSON.stringify({ text: `:fire: Hot lead (${$json.score}/10): ${$json.name} <${$json.email}>\\n${$json.summary}\\nNext step: ${$json.nextStep}` }) }}";

const responseBody = "={{ JSON.stringify({ ok: true, score: $('Parse AI result').item.json.score, category: $('Parse AI result').item.json.category }) }}";

const workflow = {
  name: 'AI Lead Qualification (Webhook → OpenAI → Slack)',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'lead-intake', responseMode: 'responseNode', options: {} },
      id: 'a1b2c3d4-0001-4000-8000-000000000001',
      name: 'New lead (webhook)',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 300],
      webhookId: 'a1b2c3d4-0001-4000-8000-0000000000aa',
    },
    {
      parameters: { mode: 'runOnceForEachItem', jsCode: normalizeCode },
      id: 'a1b2c3d4-0002-4000-8000-000000000002',
      name: 'Normalize lead',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 300],
    },
    {
      parameters: {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'openAiApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: aiBody,
        options: { timeout: 30000 },
      },
      id: 'a1b2c3d4-0003-4000-8000-000000000003',
      name: 'AI qualify lead',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [440, 300],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 2000,
    },
    {
      parameters: { mode: 'runOnceForEachItem', jsCode: parseCode },
      id: 'a1b2c3d4-0004-4000-8000-000000000004',
      name: 'Parse AI result',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [660, 300],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'a1b2c3d4-0005-4000-8000-0000000000c1',
              leftValue: '={{ $json.score }}',
              rightValue: 7,
              operator: { type: 'number', operation: 'gte' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'a1b2c3d4-0005-4000-8000-000000000005',
      name: 'Hot lead?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [880, 300],
    },
    {
      parameters: {
        method: 'POST',
        url: 'https://hooks.slack.com/services/REPLACE/WITH/YOUR_WEBHOOK',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: slackBody,
        options: {},
      },
      id: 'a1b2c3d4-0006-4000-8000-000000000006',
      name: 'Alert sales on Slack',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1100, 200],
    },
    {
      parameters: { respondWith: 'json', responseBody, options: {} },
      id: 'a1b2c3d4-0007-4000-8000-000000000007',
      name: 'Respond to form',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1320, 300],
    },
  ],
  connections: {
    'New lead (webhook)': { main: [[{ node: 'Normalize lead', type: 'main', index: 0 }]] },
    'Normalize lead': { main: [[{ node: 'AI qualify lead', type: 'main', index: 0 }]] },
    'AI qualify lead': { main: [[{ node: 'Parse AI result', type: 'main', index: 0 }]] },
    'Parse AI result': { main: [[{ node: 'Hot lead?', type: 'main', index: 0 }]] },
    'Hot lead?': {
      main: [
        [{ node: 'Alert sales on Slack', type: 'main', index: 0 }],
        [{ node: 'Respond to form', type: 'main', index: 0 }],
      ],
    },
    'Alert sales on Slack': { main: [[{ node: 'Respond to form', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  pinData: {},
};

const out = path.join(__dirname, 'workflows', 'ai-lead-qualification.json');
fs.writeFileSync(out, JSON.stringify(workflow, null, 2) + '\n');
console.log(`Wrote ${path.relative(__dirname, out)}`);
