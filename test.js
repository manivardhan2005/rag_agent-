const fetch = require('node-fetch');

async function test() {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'what is dc water' }] })
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
test();
