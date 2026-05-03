import { exec } from 'child_process';
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/run-forecast',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({}));
req.end();
