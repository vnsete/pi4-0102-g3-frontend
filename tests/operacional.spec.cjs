// Operational workflows with simulated APIs; no real backend or database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../public');
 const server=http.createServer((req,res)=>{
  const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage(),errors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.message));
  const responses={
   '/sessao':{papel:'admin'},'/clientes':{clientes:[{clienteId:1,nome:'Cliente Operacional',telefone:'13999999999'}]},
   '/servicos':{servicos:[{servicoId:3,clienteId:1,descricao:'Visita operacional',status:'registrado',catalogoId:2,valorPrevisto:120}]},
   '/catalogo-servicos':{catalogo:[{catalogoId:2,nome:'Manutencao',precoPadrao:120,duracaoMinutos:60}]},
   '/configuracoes':{nomeEmpresa:'ServiHUB',usarClientes:true,usarAgenda:true,usarOrcamentos:true,usarPagamentos:true},
   '/clientes/1/enderecos':{enderecos:[]},'/clientes/1/historico':{servicos:[]},'/agenda':{atendimentos:[]}
  };
  await page.route('**/api/**',async route=>{
   const req=route.request(),key=new URL(req.url()).pathname.slice(4);
   if(req.method()!=='GET'){posts.push({key,method:req.method(),body:req.postDataJSON()});await route.fulfill({status:200,json:{ok:true}});return;}
   if(!responses[key]){errors.push('Unexpected API: '+key);await route.fulfill({status:404,json:{mensagem:'Unexpected API'}});return;}
   await route.fulfill({json:responses[key]});
  });
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url+'#clientes');await page.locator('#client-table').waitFor();
  await page.locator('[data-action=cliente]').click();
  await page.locator('#fields [name=nome]').fill('Novo Cliente');await page.locator('#fields [name=telefone]').fill('13999999999');
  await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal(posts[0].key,'/clientes');assert.equal(posts[0].body.nome,'Novo Cliente');
  await page.locator('[data-action=detail]').click();await page.locator('[data-action=endereco]').click();
  for(const [name,value] of Object.entries({logradouro:'Rua teste',numero:'10',bairro:'Centro',cidade:'Santos',cep:'11000000'}))await page.locator('#fields [name='+name+']').fill(value);
  await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal(posts[1].key,'/clientes/1/enderecos');
  await page.locator('[data-page=servicos]').click();await page.locator('[data-action=tabatendimentos]').click();
  await page.locator('[data-action=servico]').click();await page.locator('#fields [name=clienteId]').selectOption('1');await page.locator('#fields [name=catalogoId]').selectOption('2');
  assert.equal(await page.locator('#fields [name=valorPrevisto]').inputValue(),'120');
  await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal(posts[2].key,'/servicos');
  await page.locator('[data-page=agenda]').click();await page.locator('.calendar').waitFor();
  await page.locator('[data-action=nextmonth]').click();await page.locator('.calendar').waitFor();
  await page.locator('[data-action=agenda]').click();await page.locator('#fields [name=servicoId]').selectOption('3');
  await page.locator('#fields [name=inicioEm]').fill('2026-11-15T10:00');await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.deepEqual(posts[3],{key:'/agendamentos',method:'POST',body:{servicoId:3,inicioEm:'2026-11-15T10:00:00-03:00'}});
  assert.deepEqual(errors,[]);
  console.log('PASS Operacional: customer, address, service catalogue defaults and entire agenda without financial APIs.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
