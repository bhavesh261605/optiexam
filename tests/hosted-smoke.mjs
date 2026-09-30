import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = process.env.SMOKE_URL || 'http://127.0.0.1:3140';
const email = `qa-${Date.now()}@example.com`;
const password = randomBytes(24).toString('hex');
let cookie = '';
async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(base + '/api/' + path, {
    method, headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  return data;
}
assert.equal((await request('me')).user, null);
await request('register', 'POST', {name: 'Kavya QA',email,password});
const user = (await request('me')).user;
assert.equal(user.name, 'Kavya QA');
await request('admin', 'GET', undefined, 403);
const preferences = (await request('me')).preferences;
await request('preferences', 'PUT', {...preferences, language:'hi',contrast:true});
await request('logout','POST',{});
await request('signin','POST',{email,password});
assert.equal((await request('me')).preferences.language,'hi');
const exams = await request('exams');
assert.ok(exams.length >= 2);
const [first,second] = await Promise.all([request('attempts','POST',{examId:'reasoning-practice'}),request('attempts','POST',{examId:'reasoning-practice'})]);
assert.equal(first.id,second.id,'Concurrent starts must share one attempt');
assert.ok(!('correct' in first.questions[0]));
await Promise.all(first.questions.map((q,i)=>request(`attempts/${first.id}/responses/${q.id}`,'PUT',{answer:i,review:false})));
assert.equal(Object.keys((await request(`attempts/${first.id}`)).answers).length,first.questions.length);
await Promise.all([request(`attempts/${first.id}/submit`,'POST',{}),request(`attempts/${first.id}/submit`,'POST',{})]);
assert.equal((await request(`attempts/${first.id}/result`)).status,'evaluated');
assert.equal((await request('analytics')).length,1);
const audio = await request('tts','POST',{text:'नमस्ते। आपकी परीक्षा तैयार है।',language:'hi'});
assert.ok(Array.isArray(audio.audios) && audio.audios[0].length > 100);
if (process.env.SMOKE_TRANSCRIPTION === '1') {
  const form = new FormData();
  form.set('file',new Blob([Buffer.from(audio.audios[0],'base64')],{type:'audio/wav'}),'sample.wav');
  form.set('language','hi');
  const response = await fetch(base+'/api/voice/transcribe',{method:'POST',headers:{cookie},body:form});
  const result = await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  assert.ok(result.text?.length > 0);
  console.log('PASS: hosted Hindi recorded-audio transcription.');
}
await request('logout','POST',{});
await request('signin','POST',{email,password});
assert.equal((await request(`attempts/${first.id}/result`)).status,'evaluated');
console.log('PASS: account, session, preferences, authorization, concurrent start/save/submit, results, analytics and Hindi speech.');
// This deliberately retains a labelled QA account and result as a persistence check.
