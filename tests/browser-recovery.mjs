// Optional browser verification: supply an existing Playwright installation if it is not installed here.
const { chromium } = await import(process.env.LUDI_PLAYWRIGHT_MODULE || 'playwright');
import { join } from 'node:path';
import { WebSocket } from 'ws';
import assert from 'node:assert/strict';
const base = process.env.LUDI_URL || 'http://127.0.0.1:8787';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Browser recovery verification requires a local runtime.');
const sockets=[];
async function client() {
 const ws=new WebSocket(base.replace('http','ws')+'/ws'); sockets.push(ws);
 const queue=[]; let wake;
 ws.on('message',b=>{queue.push(JSON.parse(String(b)));wake?.();});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 return {send:c=>ws.send(JSON.stringify(c)), async next(p){for(;;){const v=queue.shift();if(v){if(p(v))return v;continue;}await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('timeout')),8000);wake=()=>{clearTimeout(t);wake=undefined;r();};});}}};
}
const browser=await chromium.launch({headless:true,executablePath:process.env.LUDI_CHROMIUM_EXECUTABLE});
const errors=[];
try {
 const b=await client();
 // Exercise the real create form and its validated default rules.
 const setup=await browser.newContext(); setup.setDefaultTimeout(8000); const form=await setup.newPage(); form.on('pageerror',e=>errors.push(e.message));
 await form.goto(base); await form.getByRole('button',{name:'Play',exact:true}).click();
 await form.getByRole('button',{name:'Find your table'}).click();
 await form.locator('.create-choice').click(); await form.getByLabel('Your name').fill('Browser host');
 await form.getByRole('button',{name:'Create private table'}).click();
 await form.waitForFunction(()=>!!localStorage.getItem('ludi.room'));
 const saved=JSON.parse(await form.evaluate(()=>localStorage.getItem('ludi.room')));
 b.send({type:'join',code:saved.code,name:'Browser guest'});
 await b.next(v=>v.type==='state' && v.token);
 b.send({type:'ready',ready:true});

 await form.getByRole('button',{name:'Ready up',exact:true}).click();
 await form.getByRole('button',{name:'Start session',exact:true}).click();
 await form.waitForSelector('.screen-table');
 await form.screenshot({path:join(process.cwd(),'docs/build-004b/desktop-connected.png')});
 await setup.setOffline(true);
 await form.getByRole('status').filter({hasText:/Connection interrupted/}).waitFor();
 assert.ok(await form.locator('.screen-table svg').count());
 assert.equal(await form.getByRole('button',{name:/Roll dice/}).isEnabled(),false);
 await form.screenshot({path:join(process.cwd(),'docs/build-004b/desktop-interrupted.png')});
 await setup.setOffline(false);
 await form.waitForFunction(()=>document.querySelector('.session-status')?.textContent?.match(/Session restored|Connected/));
 await form.reload(); await form.getByRole('button',{name:'Resume Game',exact:true}).click();
 await form.waitForSelector('.screen-table');
 await form.setViewportSize({width:390,height:844});
 await form.screenshot({path:join(process.cwd(),'docs/build-004b/mobile-restored.png')});
 const second=await setup.newPage(); await second.goto(base);
 await second.getByRole('button',{name:'Resume Game',exact:true}).click(); await second.waitForSelector('.screen-table');
 await form.getByText('Your player seat is connected in another session.',{exact:true}).waitFor();
 await form.waitForTimeout(1800);
 assert.ok((await second.locator('.session-status').innerText()).match(/Session restored|Connected/));
 await form.getByRole('button',{name:'Return to Lobby',exact:true}).click();
 await form.waitForSelector('.screen-online');
 assert.equal(await form.evaluate(()=>localStorage.getItem('ludi.room')),null);
 await form.locator('.create-choice').click();
 await form.getByLabel('Your name').fill('Fresh table');
 await form.getByRole('button',{name:'Create private table'}).click();
 await form.waitForSelector('.screen-lobby');
 assert.deepEqual(errors,[]);
 console.log('PASS real browser: form create, initial snapshot, offline board preservation/actions disabled, online recovery, reload Resume Game, 390px mobile, new-tab ownership without reconnect fighting; no page errors');
} finally {for(const ws of sockets)ws.terminate();await browser.close();}
