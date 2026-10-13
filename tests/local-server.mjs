import http from 'node:http';import worker from '../src/index.js';import {setupDemo} from './support.mjs';
const {env}=await setupDemo();
const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:8789'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(String(error));}});
server.listen(8789,'127.0.0.1',()=>console.log('Local test server: http://127.0.0.1:8789 (synthetic data only)'));
