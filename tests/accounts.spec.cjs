// Browser regressions with mocked APIs: no requests reach MySQL or the backends.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

(async () => {
 const root=path.resolve(__dirname,'../public');
 const server=http.createServer((req,res)=>{
  const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();
  let posts=[],holdAccounts=false,releaseAccounts,failGet=false,failPost=true,releasePost;
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),key=url.pathname.slice(4);
   if(key==='/contas'&&req.method()==='POST'){
    posts.push(req.postDataJSON());await new Promise(resolve=>releasePost=resolve);
    await route.fulfill({status:failPost?409:201,json:failPost?{mensagem:'E-mail já cadastrado.'}:{contaId:42}});return;
   }
   if(key==='/contas'&&holdAccounts)await new Promise(resolve=>releaseAccounts=resolve);
   if(key==='/contas'&&failGet){await route.fulfill({status:503,json:{mensagem:'Consulta indisponível.'}});return;}
   const responses={
    '/sessao':{autenticado:true,contaId:1,papel:'admin'},
    '/clientes':{clientes:[{clienteId:7,nome:'Cliente Teste'}]},'/servicos':{servicos:[]},
    '/catalogo-servicos':{catalogo:[]},'/configuracoes':{nomeEmpresa:'ServiHUB',usarClientes:true,usarAgenda:true,usarOrcamentos:true,usarPagamentos:true},
    '/contas':{contas:[{id:1,nome:'Administrador',email:'admin@example.test',papel:'admin'}],totalClientes:1}
   };
   if(!responses[key])throw new Error('API inesperada: '+key);
   await route.fulfill({json:responses[key]});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/#contas`);
  const form=page.locator('#create-account');await form.waitFor();
  await form.locator('[name=nome]').fill('Nome preservado');
  await form.locator('[name=email]').fill('conta@example.test');
  const password=form.locator('[name=senha]');
  const numeric=await password.getAttribute('pattern');
  await password.fill(numeric?'012345':'senha-teste-1234');
  await form.locator('[name=papel]').selectOption('cliente');
  await form.locator('[name=clienteId]').selectOption('7');
  if(numeric){
   for(const invalid of ['12345','12a456']){await password.fill(invalid);await form.locator('[type=submit]').click();assert.equal(posts.length,0);}
   await password.fill('012345');
  }
  await password.focus();
  await page.evaluate(()=>window.originalAccountForm=document.querySelector('#create-account'));
  const expectPreserved=async()=>{
   assert.equal(await form.locator('[name=nome]').inputValue(),'Nome preservado');
   assert.equal(await form.locator('[name=email]').inputValue(),'conta@example.test');
   assert.equal(await password.inputValue(),numeric?'012345':'senha-teste-1234');
   assert.equal(await form.locator('[name=clienteId]').inputValue(),'7');
   assert.equal(await page.evaluate(()=>window.originalAccountForm===document.querySelector('#create-account')),true);
  };
  await page.clock.runFor(16000);await page.waitForTimeout(100);await expectPreserved();
  assert.equal(await password.evaluate(el=>document.activeElement===el),true);
  console.log('PASS: polling de 15 segundos preserva campos, node e foco');
  holdAccounts=true;await page.locator('#refresh').click();
  await page.waitForFunction(()=>true);while(!releaseAccounts)await new Promise(r=>setTimeout(r,10));
  await form.locator('[name=nome]').fill('Nome preservado');holdAccounts=false;releaseAccounts();
  await page.waitForTimeout(100);await expectPreserved();
  console.log('PASS: resposta tardia de consulta preserva o formulario');
  failGet=true;await page.locator('#refresh').click();await page.locator('#page-error').waitFor();await expectPreserved();failGet=false;
  console.log('PASS: erro de consulta preserva o formulario');
  await page.locator('[data-page=configuracoes]').click();await page.locator('#settings-form').waitFor();
  await page.locator('[data-page=contas]').click();await form.waitFor();await expectPreserved();
  console.log('PASS: navegacao entre paginas preserva o rascunho somente em memoria');
  await form.locator('[name=email]').fill('invalido');await form.locator('[type=submit]').click();assert.equal(posts.length,0);
  await form.locator('[name=email]').fill('conta@example.test');
  await form.locator('[name=clienteId]').selectOption('');await form.locator('[type=submit]').click();assert.equal(posts.length,0);
  await form.locator('[name=clienteId]').selectOption('7');
  await form.locator('[type=submit]').click();while(!releasePost)await new Promise(r=>setTimeout(r,10));
  assert.equal(await form.locator('[type=submit]').isDisabled(),true);
  await form.dispatchEvent('submit');assert.equal(posts.length,1);
  assert.deepEqual(posts[0],{nome:'Nome preservado',email:'conta@example.test',senha:numeric?'012345':'senha-teste-1234',papel:'cliente',clienteId:7});
  releasePost();await page.locator('#account-error').filter({hasText:'E-mail já cadastrado.'}).waitFor();await expectPreserved();
  console.log('PASS: validacao, JSON, envio unico e erro de cadastro sem perda de valores');
  releasePost=null;failPost=false;await form.locator('[type=submit]').click();while(!releasePost)await new Promise(r=>setTimeout(r,10));releasePost();
  await page.locator('#toast').filter({hasText:'Conta criada.'}).waitFor();assert.equal(await password.inputValue(),'');
  await form.locator('[name=nome]').fill('Cancelar');await form.locator('[type=reset]').click();assert.equal(await form.locator('[name=nome]').inputValue(),'');
  assert.deepEqual(errors,[]);console.log('PASS: sucesso e cancelamento limpam campos; nenhum erro JavaScript');
  const signup=await browser.newPage();let signupPosts=[],signupFail=true;
  await signup.route('**/api/**',async route=>{
   const key=new URL(route.request().url()).pathname;
   if(key==='/api/sessao'){await route.fulfill({status:401,json:{mensagem:'Entre novamente.'}});return;}
   assert.equal(key,'/api/cadastro');signupPosts.push(route.request().postDataJSON());
   await route.fulfill({status:signupFail?409:201,json:signupFail?{mensagem:'E-mail já cadastrado.'}:{contaId:43}});
  });
  await signup.goto(`http://127.0.0.1:${server.address().port}/`);await signup.locator('#show-signup').click();
  const signupForm=signup.locator('#signup-form');
  const signupValues={nome:'Cliente Teste',telefone:'11999990000',email:'novo@example.test',senha:'012345',logradouro:'Rua Teste',numero:'10',bairro:'Centro',cidade:'São Paulo',cep:'01000000'};
  for(const [name,value]of Object.entries(signupValues))await signupForm.locator(`[name=${name}]`).fill(value);
  await signupForm.locator('[name=uf]').selectOption('SP');
  await signupForm.locator('[name=senha]').fill('abcdef');await signupForm.locator('[type=submit]').click();assert.equal(signupPosts.length,0);
  await signupForm.locator('[name=senha]').fill('012345');await signupForm.locator('[type=submit]').click();await signup.locator('#signup-error').filter({hasText:'E-mail já cadastrado.'}).waitFor();
  assert.deepEqual(signupPosts[0],{...signupValues,uf:'SP'});assert.equal(await signupForm.locator('[name=senha]').inputValue(),'012345');
  signupFail=false;await signupForm.locator('[type=submit]').click();await signup.locator('#login').waitFor();assert.equal(await signup.locator('#login-form [name=email]').inputValue(),'novo@example.test');assert.equal(await signupForm.locator('[name=senha]').inputValue(),'');
  await signup.locator('#show-signup').click();await signupForm.locator('[name=nome]').fill('Cancelar');await signup.locator('#cancel-signup').click();assert.equal(await signupForm.locator('[name=nome]').inputValue(),'');
  console.log('PASS: cadastro publico valida seis numeros, envia endereco sem perfil, preserva erros e limpa no sucesso/cancelamento');
  for(const role of ['cliente','funcionario']){
   const portal=await browser.newPage(),calls=[];
   await portal.route('**/api/**',async route=>{
    const key=new URL(route.request().url()).pathname.slice(4);calls.push(key);
    if(key==='/sessao'){await route.fulfill({json:{autenticado:true,papel:role}});return;}
    assert.equal(key,role==='cliente'?'/minha-conta':'/area-funcionario');
    await route.fulfill({json:{servicos:[],agenda:[],catalogo:[]}});
   });
   await portal.goto(`http://127.0.0.1:${server.address().port}/#contas`);
   await portal.locator('#content h2').first().waitFor();
   assert.equal(await portal.locator('.sidebar nav a:visible').count(),0);
   assert.equal(await portal.locator('#create-account').count(),0);
   assert.deepEqual(calls,['/sessao',role==='cliente'?'/minha-conta':'/area-funcionario']);
   await portal.close();
  }
  console.log('PASS: cliente e funcionario acessam portais distintos e nao consultam modulos administrativos/financeiros');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
