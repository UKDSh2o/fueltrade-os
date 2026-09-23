import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

test('authentication, deal membership, messaging and role enforcement', async t => {
  const {server}=createApp({dbPath:':memory:',bootstrapEmail:'admin@test.local',bootstrapPassword:'a-long-test-password'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async (path,method='GET',data,cookie) => {
    const response=await fetch(base+path,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  assert.equal((await call('/api/deals')).status,401);
  assert.equal((await call('/api/login','POST',{email:'admin@test.local',password:'wrong'})).status,401);
  const admin=(await call('/api/login','POST',{email:'admin@test.local',password:'a-long-test-password'})).cookie;
  const user=(await call('/api/users','POST',{email:'captain@test.local',password:'a-long-test-password',role:'captain'},admin)).data;
  const captain=(await call('/api/login','POST',{email:'captain@test.local',password:'a-long-test-password'})).cookie;
  assert.equal((await call('/api/deals','POST',{reference:'FT-001',data:{volumeMt:100}},captain)).status,403);
  const id=(await call('/api/deals','POST',{reference:'FT-001',data:{volumeMt:100}},admin)).data.id;
  assert.equal((await call(`/api/deals/${id}`, 'GET',undefined,captain)).status,404);
  assert.equal((await call(`/api/deals/${id}/members`,'POST',{userId:user.id},captain)).status,404);
  assert.equal((await call(`/api/deals/${id}/members`,'POST',{userId:user.id},admin)).status,200);
  assert.equal((await call(`/api/deals/${id}`,'PUT',{data:{volumeMt:200}},captain)).status,403);
  assert.equal((await call(`/api/deals/${id}/messages`,'POST',{body:'Vessel on schedule'},captain)).status,201);
  assert.equal((await call(`/api/deals/${id}/messages`,'GET',undefined,admin)).data[0].body,'Vessel on schedule');
  assert.equal((await call('/api/logout','POST',{},captain)).status,200);
  assert.equal((await call('/api/me','GET',undefined,captain)).status,401);
});
