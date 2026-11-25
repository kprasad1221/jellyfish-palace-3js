import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=path.resolve('dist');let count=0;function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]);}
for(const file of walk(root).filter(p=>p.endsWith('.js'))){execFileSync(process.execPath,['--check',file]);count++;const code=fs.readFileSync(file,'utf8');for(const m of code.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){if(!fs.existsSync(path.resolve(path.dirname(file),m[1])))throw new Error('Missing import '+m[1]+' from '+file);}}
for(const file of ['index.html','style.css','assets/palace-audio.wav','assets/reference.mp4','assets/reference.jpg'])if(!fs.existsSync(path.join(root,file)))throw new Error('Missing '+file);
console.log(`Checked ${count} JavaScript modules, local import paths, and required assets.`);
