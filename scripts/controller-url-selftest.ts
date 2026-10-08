import assert from 'node:assert/strict';
import { controllerUrlForRoom } from '../shared/controllerUrl';

assert.equal(controllerUrlForRoom('http://localhost:5174', 'ABCDE', ['192.168.1.79']), 'http://192.168.1.79:5174/controller.html?room=ABCDE');
assert.equal(controllerUrlForRoom('http://127.0.0.1:3001', 'ABCDE', ['192.168.1.79']), 'http://192.168.1.79:3001/controller.html?room=ABCDE');
assert.equal(controllerUrlForRoom('http://192.168.1.79:3001', 'ABCDE', ['10.1.2.3']), 'http://192.168.1.79:3001/controller.html?room=ABCDE');
assert.equal(controllerUrlForRoom('https://party.example', 'ABCDE', ['192.168.1.79']), 'https://party.example/controller.html?room=ABCDE');
assert.equal(controllerUrlForRoom('http://localhost:3001', 'ABCDE'), 'http://localhost:3001/controller.html?room=ABCDE');
assert.equal(controllerUrlForRoom('http://localhost:3001', 'A&B', ['999.1.1.1', '127.0.0.1', '169.254.1.2', 'invalid', '192.168.1.79']), 'http://192.168.1.79:3001/controller.html?room=A%26B');
assert.equal(controllerUrlForRoom('http://[::1]:5174', 'ABCDE', ['192.168.1.79']), 'http://192.168.1.79:5174/controller.html?room=ABCDE');
console.log('Controller URL: actual DEV/production ports, LAN/cloud hosts, fallback, encoding and invalid addresses: 7 PASS');
