// Isolated component specimen: synthetic states unavailable in the default demo.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const output=resolve('docs/validation/arch-01b3a/roster-editor-visual/states');await mkdir(output,{recursive:true});
const bundle=await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RosterPage} from './src/modules/work/pages/RosterPage';
import {shifts,settings,referenceDay} from './src/modules/work/demo/fixtures';
import styles from './src/modules/work/work-demo.module.css';
const statuses=['planned','worked','confirmed','cancelled','modified','payslip','paid_leave','unpaid_leave'];
const kinds=['day','night','off','annual_leave','sick_leave','custom','day','night'];
const specimen=statuses.map((status,i)=>({...shifts[0],id:'specimen-'+i,shift_date:'2026-09-'+(20+i),kind:kinds[i],status}));
specimen.push({...specimen[0],id:'extra-1'},{...specimen[0],id:'extra-2'});
createRoot(document.getElementById('root')).render(<main className={styles.workDemo}><p className={styles.banner}>DEMOSTRACIÓN · espécimen sintético de estados · sin persistencia</p><RosterPage shifts={specimen} settings={settings} overtimePreferences={[]} referenceDate={new Date(referenceDay+'T12:00:00')} onBatch={()=>{}}/></main>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'out',entryNames:'specimen',format:'iife',define:{'process.env.NODE_ENV':'"production"'},minify:true});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button,input,select{font:inherit;box-sizing:border-box}${css}</style><div id="root"></div><script>${js}</script>`);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});const checks=[];
try{
 for(const width of [360,390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},timezoneId:'Pacific/Auckland',serviceWorkers:'block'});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const marks=page.locator('[data-status]');await marks.first().waitFor();
  assert.deepEqual(await marks.evaluateAll(nodes=>nodes.map(n=>n.dataset.status)),['planned','worked','confirmed','cancelled','modified','payslip','paid_leave','unpaid_leave']);
  assert.deepEqual(await marks.evaluateAll(nodes=>nodes.map(n=>n.textContent.trim().split(/\s+/).at(-1))),['P','T','C','×','M','R','LP','LS']);
  const styles=await marks.evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,color:s.color,border:s.borderTopStyle,decoration:s.textDecorationLine};}));
  assert.equal(styles[0].background,'rgb(255, 241, 185)');assert.equal(styles[1].background,'rgb(223, 229, 255)');assert.equal(styles[2].background,'rgb(231, 236, 234)');
  assert.equal(styles[2].border,'double');assert.equal(styles[3].decoration,'line-through');assert.equal(styles[4].border,'dashed');
  const luminance=rgb=>{const c=rgb.match(/\d+/g).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  for(const s of styles){const values=[luminance(s.color),luminance(s.background)].sort((a,b)=>a-b);assert.ok((values[1]+.05)/(values[0]+.05)>=4.5);}
  assert.match(await page.locator('[data-day="2026-09-20"]').getAttribute('aria-label'),/Planificado/);
  assert.match(await page.locator('[data-day="2026-09-20"]').innerText(),/\+2/);
  for(const day of await page.locator('[data-day]').all()){const b=await day.boundingBox();assert.ok(b.width>=44&&b.height>=44);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve(output,`states-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Seleccionar varios días'}).click();await page.locator('[data-day="2026-09-24"]').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('[data-day="2026-09-24"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-day="2026-09-24"]').evaluate(n=>n.matches(':focus-visible')),true);
  await page.screenshot({path:resolve(output,`states-focus-${width}.png`),fullPage:true});
  checks.push({width,status:'PASS',textContrast:'>=4.5:1',allKindsAndStatuses:true,multipleOverflow:'+2',targets:'>=44x44',keyboardSelectionAndFocus:true});await page.close();
 }
 await writeFile(resolve(output,'result.json'),JSON.stringify({status:'PASS',checks,limits:'Isolated bundled Roster component with synthetic props; not protected-record mutation or hosted preview.'},null,2));console.log(JSON.stringify(checks,null,2));
}finally{await browser.close();await new Promise(done=>server.close(done));}
