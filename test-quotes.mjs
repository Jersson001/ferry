import fetch from 'node-fetch';

async function main() {
  try {
    const res = await fetch('http://localhost:3000/quotes/requests/pending');
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}

main();
