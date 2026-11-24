import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root=fileURLToPath(new URL('.',import.meta.url));
function option(name:string,fallback:string) {
  const flag='--'+name, index=process.argv.indexOf(flag);
  if (index>=0) {
    if (!process.argv[index+1] || process.argv[index+1].startsWith('--')) throw new Error('Missing value for '+flag);
    return process.argv[index+1];
  }
  return process.argv.find(a=>a.startsWith(flag+'='))?.slice(flag.length+1) ?? fallback;
}
const input=option('input','/input/snapshot.json');
const inputFile=statSync(input).isDirectory()?join(input,'snapshot.json'):input;
const output=resolve(option('output',process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
const snapshot=parseSnapshot(readFileSync(inputFile,'utf8'));
const {board,radar}=buildRadar(snapshot);
const issue=boardIssue(board,snapshot);
if (issue) throw new Error('Board refused: '+issue);
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'board.json'),JSON.stringify({as_of:snapshot.as_of,model_version:'peer-radar-v1',rows:board})+'\n');
writeFileSync(join(output,'data.js'),dataScript(radar));
for (const folder of ['dashboard','screenshots']) {
  const source=join(root,folder);
  if (!existsSync(source)) throw new Error('Missing '+folder);
  cpSync(source,join(output,folder),{recursive:true});
}
const screenshots=readdirSync(join(output,'screenshots')).filter(n=>!n.startsWith('.'));
if (screenshots.length!==3) throw new Error('Expected three original screenshots');
writeFileSync(join(output,'dossier.json'),buildDossier(output,{
  text_max_bytes:65_536,
  screenshots:{max:4,max_bytes:524_288},
  dashboard:{max_files:400,max_bytes:4_194_304}
}));
process.stdout.write(`Token Launch Radar: ${board.length} ranked; ${radar.watchlist_covered}/${snapshot.watchlist.length} watchlist; ${radar.live_size} trading. Output: ${output}\n`);
