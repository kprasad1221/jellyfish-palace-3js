import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT||8080);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.wav':'audio/wav','.mp4':'video/mp4','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}const file=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);}catch{res.writeHead(404).end('Not found');}}).listen(port,'0.0.0.0',()=>console.log(`Jellyfish Palace: http://localhost:${port}`));
