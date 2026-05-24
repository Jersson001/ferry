async function test() {
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test1@test.com', password: 'password123' })
  });
  
  if (!loginRes.ok) {
    console.log('Login failed', loginRes.status);
    // try another dummy user or register
    return;
  }
  const { accessToken } = await loginRes.json();
  
  const res1 = await fetch('http://localhost:3000/subscriptions/plans');
  const plans = await res1.json();
  const planId = plans[1].id;
  
  console.log('Fetching signature for plan:', planId);
  const res2 = await fetch(`http://localhost:3000/subscriptions/wompi/signature/${planId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const text = await res2.text();
  console.log('Status:', res2.status);
  console.log('Response:', text);
}
test();
