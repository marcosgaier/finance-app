// Conservative PR #16 cleanup: only PNGs added since its verified base.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,unlink,stat} from 'node:fs/promises';
import {resolve,relative,dirname,sep} from 'node:path';
const root=process.cwd(), audited='b5d08af909377960b505d922b9f87ecac6ea5473';
const added=execFileSync('git',['diff','--name-only','--diff-filter=A','64ca62dfabbef5e790c96036aa100abaae037436',audited,'--','docs/validation'],{encoding:'utf8'}).trim().split('\n');
const images=added.filter(p=>p.endsWith('.png'));
const keep=images.filter(p=>
  /worked-editor\/before\/editor-(360|390|1280)\.png$/.test(p)||
  /worked-editor\/after\/(editor|worked-editor|worked-saved|batch-preview|batch-week|payments)-(360|390|1280)\.png$/.test(p)||
  /worked-editor\/(planning\/planner-(mobile|desktop)|payments\/(payment|manual)-(360|1280))\.png$/.test(p));
const removed=images.filter(p=>!keep.includes(p));
const inventory=[];
for(const path of removed){
  const full=resolve(root,path);
  if(!full.startsWith(resolve(root,'docs/validation')+sep))throw Error('Outside evidence directory');
  inventory.push({path,bytes:(await stat(full)).size});
}
const removedSet=new Set(removed);
const markdown=execFileSync('git',['ls-files','*.md'],{encoding:'utf8'}).trim().split('\n');
const repaired=[];
for(const path of markdown){
  const text=await readFile(path,'utf8');
  const next=text.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g,(all,label,target)=>{
    if(/^(https?:|#)/.test(target))return all;
    const local=relative(root,resolve(dirname(path),target)).split(sep).join('/');
    if(!removedSet.has(local))return all;
    return `${label.replace(/^!/, '').replace(/\]$/, ' · archivo histórico]')}(https://github.com/marcosgaier/finance-app/blob/${audited}/${local})`;
  });
  if(next!==text){await writeFile(path,next);repaired.push(path);}
}
await writeFile('docs/validation/pr16-minimal/cleanup-manifest.json',JSON.stringify({audited,base:'64ca62dfabbef5e790c96036aa100abaae037436',kept:keep,removed:inventory,removedBytes:inventory.reduce((n,f)=>n+f.bytes,0),repairedMarkdown:repaired},null,2)+'\n');
for(const {path} of inventory)await unlink(path);
console.log(JSON.stringify({kept:keep.length,removed:removed.length,removedBytes:inventory.reduce((n,f)=>n+f.bytes,0),repaired:repaired.length}));
