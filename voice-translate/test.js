process.env.MOCK_TRANSLATE = '1';
const assert = require('assert');
const server = require('./server');
server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const post = (b) => fetch(base + '/api/translate', { method: 'POST', body: JSON.stringify(b) });
  let r = await post({ text: 'hello', from: 'en-US', to: 'es' });
  assert.equal((await r.json()).translation, '[es] hello');
  r = await post({ text: 'hello', from: 'en-US', to: 'en' });
  assert.equal((await r.json()).translation, 'hello');
  assert.equal((await post({ text: 'x' })).status, 400);
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/../server.js')).status, 404);
  console.log('all tests passed'); server.close();
});
