function parseQualification(aiResponse, lead) {
  const content = aiResponse && aiResponse.choices && aiResponse.choices[0]
    && aiResponse.choices[0].message && aiResponse.choices[0].message.content;
  let parsed = {};
  try {
    parsed = JSON.parse(content || '{}');
  } catch (e) {
    parsed = {};
  }
  const rawScore = Number(parsed.score);
  const score = Number.isFinite(rawScore) ? Math.min(10, Math.max(0, Math.round(rawScore))) : 0;
  const category = ['hot', 'warm', 'cold'].includes(parsed.category)
    ? parsed.category
    : score >= 7 ? 'hot' : score >= 4 ? 'warm' : 'cold';
  return {
    ...lead,
    score,
    category,
    summary: String(parsed.summary || '').slice(0, 500) || 'No summary returned',
    nextStep: String(parsed.next_step || '').slice(0, 300) || 'Review manually',
    aiParsed: Boolean(content) && Object.keys(parsed).length > 0,
  };
}

module.exports = { parseQualification };
