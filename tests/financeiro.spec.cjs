// Financial workflows with simulated APIs; no real backend or database.
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
   '/sessao':{papel:'admin'},'/clientes':{clientes:[{clienteId:1,nome:'Cliente Financeiro'}]},
   '/servicos':{servicos:[{servicoId:3,clienteId:1,descricao:'Visita teste',status:'registrado',catalogoId:2,valorPrevisto:120}]},
   '/catalogo-servicos':{catalogo:[{catalogoId:2,nome:'Manutencao',precoPadrao:120,duracaoMinutos:60}]},
   '/configuracoes':{nomeEmpresa:'ServiHUB',usarClientes:true,usarAgenda:true,usarOrcamentos:true,usarPagamentos:true},
   '/financeiro/orcamentos':{orcamentos:[{orcamentoId:4,clienteId:1,descricao:'Proposta teste',valorTotal:120,status:'pendente'}]},
   '/financeiro/pagamentos':{pagamentos:[{pagamentoId:5,servicoId:3,nomeCliente:'Cliente Financeiro',descricao:'Visita teste',valor:120,situacao:'pendente'}],pagamentosOrcamento:[]},
   '/financeiro/servicos/3/pagamento':{valor:120,situacao:'pendente'},
   '/financeiro/pendencias':{pendencias:[{servicoId:3,nomeCliente:'Cliente Financeiro',descricao:'Visita teste',valor:120,situacao:'pendente'}]},
   '/financeiro/lembretes':{lembretes:[{nomeCliente:'Cliente Financeiro',inicioEm:'2026-10-30T12:00:00Z',mensagem:'Visita de teste em breve.'}]}
  };
  await page.route('**/api/**',async route=>{
   const req=route.request(),key=new URL(req.url()).pathname.slice(4);
   if(req.method()!=='GET'){posts.push({key,method:req.method(),body:req.postDataJSON()});await route.fulfill({status:200,json:{ok:true}});return;}
   if(!responses[key]){errors.push('Unexpected API: '+key);await route.fulfill({status:404,json:{mensagem:'Unexpected API'}});return;}
   await route.fulfill({json:responses[key]});
  });
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url+'#orcamentos');await page.locator('#quote-table').waitFor();
  await page.locator('[data-action=orcamento]').click();
  await page.locator('#fields [name=clienteId]').selectOption('1');
  await page.locator('#fields [name=catalogoId]').selectOption('2');
  assert.equal(await page.locator('#fields [name=valorTotal]').inputValue(),'120');
  await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.deepEqual(posts[0],{key:'/financeiro/orcamentos',method:'POST',body:{clienteId:1,catalogoId:2,descricao:'Manutencao',valorTotal:120}});
  await page.locator('[data-action=quoteview]').click();await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal(posts[1].key,'/financeiro/orcamentos/4/status');assert.equal(posts[1].method,'PATCH');
  await page.locator('[data-page=pagamentos]').click();await page.locator('#payment-table').waitFor();
  await page.locator('[data-action=pagamento]').first().click();await page.locator('#fields [name=servicoId]').selectOption('3');
  await page.waitForFunction(()=>document.querySelector('#fields [name=valor]').value==='120'&&!document.querySelector('#save-record').disabled);
  await page.locator('#save-record').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal(posts[2].key,'/financeiro/servicos/3/pagamento');assert.equal(posts[2].method,'PUT');assert.equal(posts[2].body.servicoId,undefined);
  await page.locator('[data-action=collect]').click();assert.match(await page.locator('#fields textarea').inputValue(),/Cliente Financeiro/);
  assert.equal(await page.locator('#save-record').isVisible(),false);await page.locator('#modal [data-close]').first().click();
  await page.locator('[data-page=pendencias]').click();await page.getByText('Visita de teste em breve.').waitFor();
  await page.locator('[data-action=pagamento]').click();await page.waitForFunction(()=>document.querySelector('#fields [name=valor]').value==='120');
  assert.deepEqual(errors,[]);
  console.log('PASS Financeiro: quotes, catalogue defaults, approval, payments, collection, pending payments and reminders.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
