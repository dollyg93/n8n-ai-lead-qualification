function normalizeLead(body) {
  const src = body && typeof body === 'object' ? body : {};
  const email = String(src.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required');
  }
  const message = String(src.message || src.notes || '').trim();
  if (!message) {
    throw new Error('A message describing the request is required');
  }
  return {
    name: String(src.name || '').trim() || 'Unknown',
    email,
    company: String(src.company || '').trim() || null,
    budget: String(src.budget || '').trim() || null,
    message: message.slice(0, 4000),
    source: String(src.source || 'website-form'),
    receivedAt: new Date().toISOString(),
  };
}

module.exports = { normalizeLead };
