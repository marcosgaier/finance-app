import {execFileSync} from 'node:child_process';
import {stat,writeFile} from 'node:fs/promises';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const base='64ca62dfabbef5e790c96036aa100abaae037436';
const before='b5d08af909377960b505d922b9f87ecac6ea5473';
const paths=git('diff','--name-only',base,before,'--','docs/validation').split('\n');
const priorBytes=Number(git('ls-tree','-rl',before,'--','docs/validation').split('\n').reduce((sum,line)=>sum+Number(line.split(/\s+/)[3]),0));
let currentBytes=0,currentFiles=0;
for(const path of git('ls-files','--cached','--others','--exclude-standard','docs/validation').split('\n')){
  try{currentBytes+=(await stat(path)).size;currentFiles++;}catch{}
}
const objects=git('rev-list','--objects',`${base}..HEAD`).split('\n').map(line=>line.split(' ')[0]);
const sizes=execFileSync('git',['cat-file','--batch-check=%(objecttype) %(objectsize)'],{input:objects.join('\n')+'\n',encoding:'utf8'}).trim().split('\n');
const historyBlobBytes=sizes.filter(s=>s.startsWith('blob ')).reduce((n,s)=>n+Number(s.split(' ')[1]),0);
const result={units:'decimal bytes; not Git compressed transfer size',base,previousHead:before,historyMeasuredHead:git('rev-parse','HEAD'),previousEvidenceChangedFiles:paths.length,previousEvidenceTreeBytes:priorBytes,currentEvidenceTreeFiles:currentFiles,currentEvidenceTreeBytes:currentBytes,uniqueBranchHistoryBlobBytes:historyBlobBytes,gitCountObjects:git('count-objects','-v'),note:'Deleted evidence blobs remain reachable through previous commits. No history rewritten. Run again after commit for final history size.'};
await writeFile('docs/validation/pr16-minimal/size-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
