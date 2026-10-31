// Responsavel: Samuel - toda a logica do frontend.
'use strict';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date = v => v ? new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}) : '—';
const labels = {registrado:'Registrado',agendado:'Agendado',em_andamento:'Em andamento',concluido:'Concluído',cancelado:'Cancelado',pendente:'Pendente',pago:'Confirmado',aprovado:'Aprovado',recusado:'Recusado',atrasado:'Atrasado'};
const badge = v => `<span class="badge ${esc(v)}">${esc(labels[v]||v)}</span>`;
const state = {clientes:[],servicos:[],page:'inicio',cliente:null,form:null,interval:null,renderVersion:0,catalogo:[],quotes:[],payments:[],config:{},session:null,serviceTab:'catalogo',selectedDay:null,month:null};
let pollBusy=false,toastTimer,accountDraft=null;
const pages = {};
const pageInfo = {
 inicio:['Início','Um olhar sobre sua rotina e os próximos atendimentos.'],
 contas:['Contas e acessos','Gerencie funcionários e clientes.'],
 configuracoes:['Personalização','']
};
async function api(path,options={}) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},signal:controller.signal});
  const data=await response.json();
  if(!response.ok){if(response.status===401)loginScreen();const e=new Error(data.mensagem||'Não foi possível concluir.');e.status=response.status;e.code=data.codigo;throw e;}
  return data;
 } catch(e) {
  if(e.name==='AbortError'||e instanceof TypeError)throw new Error(options.method&&options.method!=='GET'?'Resposta não confirmada. Consulte os registros antes de repetir a gravação.':'Não foi possível consultar o sistema. Tente novamente.');
  throw e;
 } finally {clearTimeout(timer);}
}
const post=(path,body,method='POST')=>api(path,{method,body:JSON.stringify(body)});
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function empty(message){return `<div class="empty"><span class="empty-symbol">◌</span>${esc(message)}</div>`;}
function panel(title,subtitle,body,action=''){return `<section class="panel"><div class="panel-heading"><div><h3>${esc(title)}</h3>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${action}</div>${body}</section>`;}
function table(headers,rows){return `<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
const clientName=id=>state.clientes.find(c=>c.clienteId===id)?.nome||`Cliente #${id}`;
const serviceName=id=>state.servicos.find(s=>s.servicoId===id)?.descricao||`Serviço #${id}`;
async function common(){const [c,s,k,g]=await Promise.all([api('/clientes'),api('/servicos'),api('/catalogo-servicos'),api('/configuracoes')]);state.clientes=c.clientes;state.servicos=s.servicos;state.catalogo=k.catalogo;state.config=g;$('#company-brand').textContent=g.nomeEmpresa;for(const page of ['clientes','agenda','orcamentos','pagamentos'])document.querySelector(`[data-page="${page}"]`).hidden=!g['usar'+page[0].toUpperCase()+page.slice(1)];}
function dateISO(d){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
const today=()=>dateISO(new Date());
const time=v=>new Date(v).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
const stat=(title,value,cls='')=>`<article class="stat ${cls}"><p>${esc(title)}</p><strong>${value}</strong></article>`;
async function dashboard(){const [v,p]=await Promise.all([visitsDay(today()),api('/financeiro/pagamentos')]);const active=v.filter(a=>a.statusServico!=='cancelado');const total=p.pagamentos.filter(x=>x.situacao==='pago'&&dateISO(new Date(x.pagoEm))===today()).reduce((n,p)=>n+Number(p.valor),0);return `<div class="stat-grid">${stat('Serviços de hoje',active.length)}${stat('Pagamentos pendentes',p.pagamentos.filter(x=>x.situacao==='pendente').length)}${stat('Total do dia',currency(total))}</div><h3>Serviços de hoje</h3>${active.length?table(['Hora','Cliente','Serviço','Status'],active.map(a=>`<tr><td>${time(a.inicioEm)}</td><td><strong>${esc(a.nomeCliente)}</strong></td><td>${esc(a.descricao)}</td><td>${badge(a.statusServico)}</td></tr>`)):empty('Nenhum serviço agendado para hoje.')}`;}
async function configuracoes(){const g=state.config;return `<section class="panel settings"><h3>Ajuste as informações</h3><p class="muted">Ajuste as informações do seu sistema.</p><form id="settings-form"><label>Nome da empresa<input name="nomeEmpresa" required maxlength="120" value="${esc(g.nomeEmpresa)}"></label><h4>Quais ferramentas você mais utiliza?</h4><div class="tools-options">${['Clientes','Agenda','Orcamentos','Pagamentos'].map((p,i)=>`<label class="checkbox"><input type="checkbox" name="usar${p}" ${g['usar'+p]?'checked':''}>${['Clientes','Agenda','Orçamentos','Pagamentos'][i]}</label>`).join('')}</div><p class="help">As opções ajustam o menu e podem ser reativadas aqui.</p><p class="form-error" id="settings-error" role="alert"></p><div class="settings-actions"><button class="primary">Salvar alterações</button></div></form></section>`;}
function showPage(html,page){
 // Keep the live form node: values, password, focus and selection survive polling
 // and responses that arrive while the administrator is typing or submitting.
 if(page==='contas'&&$('#create-account')&&$('#accounts-overview')){
  const template=document.createElement('template');template.innerHTML=html;
  $('#accounts-overview').replaceWith(template.content.querySelector('#accounts-overview'));
 }else{
  if($('#create-account'))accountDraft=$('#create-account');
  $('#content').innerHTML=html;
  if(page==='contas'&&accountDraft)$('#create-account').replaceWith(accountDraft);
 }
}
async function render(){
 if(state.session?.papel==='funcionario'){const version=++state.renderVersion;state.page='inicio';$('#page-title').textContent='Área do funcionário';$('#page-action').hidden=true;try{const html=await employeePortal();if(version===state.renderVersion)$('#content').innerHTML=html;}catch(e){if(version===state.renderVersion)$('#content').textContent=e.message;}return;}
 if(state.session?.papel==='cliente'){state.page='inicio';$('#page-title').textContent='Área do cliente';$('#page-action').hidden=true;try{$('#content').innerHTML=await clientPortal();}catch(e){$('#content').textContent=e.message;}return;}

 const version=++state.renderVersion;document.querySelector('[data-page=contas]').hidden=state.session?.papel!=='admin';document.querySelector('[data-page=configuracoes]').hidden=state.session?.papel!=='admin';let page=location.hash.slice(1)||'inicio';if(!pageInfo[page])page='inicio';state.page=page;
 const info=pageInfo[page];$('#page-title').textContent=info[0];$('#breadcrumb').textContent=info[0];$('#page-subtitle').textContent=info[1];$('#page-action').hidden=true;$('#page-action').textContent='+ '+(info[2]||'');
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===page));$('#page-error').hidden=true;
 if(!$('#content').innerHTML.trim())$('#content').textContent='Carregando…';
 try{
  await common();let html;
  html=await ({inicio:dashboard,configuracoes,...pages}[page])();
  if(version===state.renderVersion)showPage(html,page);
 }catch(e){if(version===state.renderVersion){$('#page-error').textContent=e.message;$('#page-error').hidden=false;if(!$('#create-account'))$('#content').innerHTML=empty('Não foi possível carregar esta consulta. Clique em Atualizar para tentar novamente.');}}
}
function field(title,name,type='text',attrs='',wide=false){return `<label class="${wide?'span2':''}">${esc(title)}<input name="${name}" type="${type}" ${attrs}></label>`;}
function select(title,name,options,required=true,wide=false){return `<label class="${wide?'span2':''}">${esc(title)}<select name="${name}" ${required?'required':''}>${options}</select></label>`;}
const clientsOptions=()=>'<option value="">Selecione um cliente</option>'+state.clientes.map(c=>`<option value="${c.clienteId}">${esc(c.nome)}</option>`).join('');
const serviceOptions=ss=>ss.map(s=>`<option value="${s.servicoId}">#${s.servicoId} · ${esc(clientName(s.clienteId))} · ${esc(s.descricao)}</option>`).join('');
const description=()=>'<label class="span2">Descrição<textarea name="descricao" required maxlength="500" placeholder="Descreva o atendimento ou a proposta"></textarea></label>';

// Shared modal: feature files own fields, defaults and API destinations.
async function openForm(kind,id){
 $('#record-form').reset();$('#form-error').textContent='';$('#save-record').disabled=false;$('#save-record').textContent='Salvar';state.form={kind,id};
 const owner=operationalKinds.includes(kind)?operationalFeature:financialFeature;
 const result=await owner.form(kind,id);if(!result)return;
 $('#modal-title').textContent=result.title;$('#fields').innerHTML=result.html;
 $('#save-record').hidden=!!result.readOnly;$('#modal').showModal();
 await owner.defaults(kind,id);
}
$('#fields').addEventListener('change',async e=>{try{await (operationalKinds.includes(state.form.kind)?operationalFeature:financialFeature).change(e);}catch(err){$('#form-error').textContent=err.message;}});
$('#record-form').addEventListener('submit',async e=>{
 e.preventDefault();const b=$('#save-record');b.disabled=true;b.textContent='Salvando…';$('#form-error').textContent='';
 const v=Object.fromEntries(new FormData(e.target));Object.keys(v).forEach(k=>{if(v[k]==='')delete v[k];else if(['clienteId','enderecoId','servicoId','valor','valorPrevisto','valorTotal','catalogoId','precoPadrao','duracaoMinutos'].includes(k))v[k]=Number(v[k]);else if(['inicioEm','fimEm'].includes(k))v[k]+=':00-03:00';});
 const f=state.form;
 try{const {path,method='POST'}=(operationalKinds.includes(f.kind)?operationalFeature:financialFeature).destination(f,v);await post(path,v,method);await render();$('#modal').close();toast('Registro salvo com sucesso.');}catch(err){$('#form-error').textContent=err.message;}finally{b.disabled=false;b.textContent='Salvar';}
});
$('#content').addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action,id=Number(b.dataset.id);
 if(await operationalAction(action,b,id))return;
 await openForm(action,id||undefined);
});
$('#page-action').addEventListener('click',()=>openForm(pageInfo[state.page][3]));
$('#refresh').addEventListener('click',render);
$('#modal').addEventListener('click',e=>{if(e.target.closest('[data-close]')&&!$('#save-record').disabled)$('#modal').close();});
$('#modal').addEventListener('cancel',e=>{if($('#save-record').disabled)e.preventDefault();});
window.addEventListener('hashchange',()=>{state.cliente=null;if(!$('#app').hidden)render();});
setInterval(async()=>{if(document.hidden||$('#app').hidden||$('#modal').open||pollBusy||!['inicio','agenda','clientes','servicos','contas'].includes(state.page))return;pollBusy=true;try{await render();}finally{pollBusy=false;}},15000);

function filterTable(e,configs){const config=configs[e.target.id];if(!config)return;const [items,fields,target,view]=config,q=e.target.value.toLocaleLowerCase('pt-BR');$(target).innerHTML=view(items.filter(x=>fields(x).some(v=>String(v??'').toLocaleLowerCase('pt-BR').includes(q))));}


'use strict';
// Authentication and operational features.
function loginScreen(){state.session=null;state.renderVersion++;accountDraft=null;$('#login').hidden=false;$('#app').hidden=true;$('#signup').hidden=true;$('#content').innerHTML='';}
function serviceRows(services,actions=true){return services.map(s=>`<tr><td><strong>${esc(s.descricao)}</strong><small>#${s.servicoId} · ${esc(clientName(s.clienteId))}</small></td><td>${badge(s.status)}</td><td>${s.valorPrevisto?currency(s.valorPrevisto):'Não informado'}</td><td>${actions?`<button class="table-action" data-action="status" data-id="${s.servicoId}">Alterar status</button>`:date(s.criadoEm)}</td></tr>`);}
function visitsRows(visits){return visits.map(a=>`<tr><td><strong>${esc(a.nomeCliente)}</strong><small>${esc(a.descricao)}</small></td><td>${date(a.inicioEm)}</td><td>${date(a.fimEm)}</td><td>${badge(a.statusServico)}</td></tr>`);}
const visitsDay=async day=>(await api('/agenda?'+new URLSearchParams({de:day+'T00:00:00-03:00',ate:new Date(Date.parse(day+'T00:00:00-03:00')+86400000).toISOString()}))).atendimentos;
async function clientes(){
 if(state.cliente){
  const c=state.clientes.find(c=>c.clienteId===state.cliente);if(!c){state.cliente=null;return clientes();}
  const [a,h]=await Promise.all([api(`/clientes/${c.clienteId}/enderecos`),api(`/clientes/${c.clienteId}/historico`)]);
  return `<button class="table-action back" data-action="backclientes">← Voltar para os clientes</button><div class="client-detail"><div>${panel(c.nome,'Dados do cliente',`<div class="panel-body"><div class="detail-line">Telefone<strong>${esc(c.telefone)}</strong></div><div class="detail-line">E-mail<strong>${esc(c.email||'Não informado')}</strong></div><div class="detail-line">Cliente desde<strong>${date(c.criadoEm)}</strong></div></div>`)}${panel('Endereços','Locais de atendimento',`<div class="panel-body">${a.enderecos.map(a=>`<div class="address-card"><p>${esc(a.logradouro)}, ${esc(a.numero)}</p><p>${esc(a.complemento||'')}</p><small>${esc(a.bairro)} · ${esc(a.cidade)}/${esc(a.uf)} · CEP ${esc(a.cep)}</small></div>`).join('')||empty('Nenhum endereço cadastrado.')}</div>`,`<button class="table-action" data-action="endereco" data-id="${c.clienteId}">+ Adicionar</button>`)}</div>${panel('Histórico de serviços','Do mais recente para o mais antigo',h.servicos.length?table(['Atendimento','Situação','Valor previsto','Ações'],serviceRows(h.servicos)):empty('Este cliente ainda não possui serviços.'))}</div>`;
 }
 return `<div class="toolbar"><input id="search" placeholder="Buscar cliente..." aria-label="Buscar clientes"><button class="primary" data-action="cliente">+ Novo cliente</button></div><div id="client-table">${clientTable(state.clientes)}</div>`;
}
function clientTable(cs){return cs.length?table(['Nome','Telefone','Endereço','Ações'],cs.map(c=>`<tr><td><strong>${esc(c.nome)}</strong></td><td>${esc(c.telefone)}</td><td>${esc(c.enderecoResumo||'Não cadastrado')}</td><td><button class="table-action" data-action="detail" data-id="${c.clienteId}">Visualizar</button></td></tr>`)):empty('Nenhum cliente encontrado.');}
function catalogTable(items){return items.length?table(['Nome do Serviço','Preço Padrão','Duração','Ações'],items.map(c=>`<tr><td><strong>${esc(c.nome)}</strong><small>${esc(c.descricao||'')}</small></td><td>${currency(c.precoPadrao)}</td><td>${c.duracaoMinutos} min</td><td><button class="table-action" data-action="catalogo" data-id="${c.catalogoId}">Editar</button></td></tr>`)):empty('Cadastre seu primeiro serviço no catálogo.');}
async function servicos(){return `<div class="tabs"><button data-action="tabcatalogo" class="${state.serviceTab==='catalogo'?'selected':''}">Catálogo de serviços</button><button data-action="tabatendimentos" class="${state.serviceTab==='atendimentos'?'selected':''}">Atendimentos por cliente</button></div>`+(state.serviceTab==='catalogo'?`<div class="toolbar"><input id="catalog-search" placeholder="Buscar serviço..." aria-label="Buscar serviço"><button class="primary" data-action="catalogo">+ Novo serviço</button></div><div id="catalog-table">${catalogTable(state.catalogo)}</div>`:`<div class="toolbar"><p class="muted">Histórico e andamento dos serviços contratados.</p><button class="primary" data-action="servico">+ Novo atendimento</button></div>${state.servicos.length?table(['Atendimento','Status','Valor previsto','Ações'],serviceRows(state.servicos)):empty('Nenhum atendimento registrado.')}`);}
async function agenda(){
 if(!state.selectedDay)state.selectedDay=today();if(!state.month)state.month=state.selectedDay.slice(0,7);const [year,month]=state.month.split('-').map(Number),start=new Date(Date.UTC(year,month-1,1)),end=new Date(Date.UTC(year,month,1)),last=new Date(Date.UTC(year,month,0)).getUTCDate();
 const de=state.month+'-01T00:00:00-03:00',ate=end.toISOString().slice(0,10)+'T00:00:00-03:00';const a=await api('/agenda?'+new URLSearchParams({de,ate}));const visits=a.atendimentos.filter(x=>dateISO(new Date(x.inicioEm))===state.selectedDay);let days='';for(let i=0;i<start.getUTCDay();i++)days+='<span></span>';for(let i=1;i<=last;i++){const day=state.month+'-'+String(i).padStart(2,'0'),has=a.atendimentos.some(x=>dateISO(new Date(x.inicioEm))===day&&x.statusServico!=='cancelado');days+=`<button data-action="day" data-day="${day}" class="${day===state.selectedDay?'selected':''} ${has?'has-visit':''}" aria-pressed="${day===state.selectedDay}">${i}</button>`;}
 return `<div class="toolbar"><p class="muted">Horário de São Paulo</p><button class="primary" data-action="agenda">+ Agendar visita</button></div><div class="agenda-grid"><div><section class="panel calendar"><div class="calendar-title"><button data-action="prevmonth" aria-label="Mês anterior">‹</button><h3>${esc(start.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}))}</h3><button data-action="nextmonth" aria-label="Próximo mês">›</button></div><div class="calendar-grid weekdays">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${days}</div></section><section class="panel reminders"><h3>Resumo da agenda</h3><p>• ${a.atendimentos.filter(x=>dateISO(new Date(x.inicioEm))===today()&&x.statusServico==='agendado').length} serviço(s) agendado(s) hoje</p></section></div><section class="panel day-services"><h3>Serviços do dia</h3><p class="muted">${state.selectedDay.split('-').reverse().join('/')}</p>${visits.length?visits.map(v=>`<article class="appointment"><time>${time(v.inicioEm)}</time><div><strong>${esc(v.descricao)}</strong><p>${esc(v.nomeCliente)}</p>${badge(v.statusServico)}</div></article>`).join(''):empty('Nenhum serviço neste dia.')}</section></div>`;
}
async function clientPortal(){const d=await api('/minha-conta');return `<h2>Meus serviços</h2>${d.servicos.length?table(['Serviço','Status','Valor','Criado em'],d.servicos.map(s=>`<tr><td>${esc(s.descricao)}</td><td>${badge(s.status)}</td><td>${currency(s.valorPrevisto)}</td><td>${date(s.criadoEm)}</td></tr>`)):empty('Você ainda não possui serviços.')}<h2>Meus agendamentos</h2>${d.agenda.length?table(['Serviço','Início','Fim','Status'],d.agenda.map(a=>`<tr><td>${esc(a.descricao)}</td><td>${date(a.inicioEm)}</td><td>${date(a.fimEm)}</td><td>${badge(a.status)}</td></tr>`)):empty('Nenhum agendamento.')}<h2>Serviços disponíveis</h2>${table(['Serviço','Preço','Duração'],d.catalogo.map(c=>`<tr><td>${esc(c.nome)}</td><td>${currency(c.precoPadrao)}</td><td>${c.duracaoMinutos} min</td></tr>`))}`;}
async function employeePortal(){const d=await api('/area-funcionario');return `<h2>Atendimentos</h2>${d.servicos.length?table(['Serviço','Status'],d.servicos.map(s=>`<tr><td>${esc(s.descricao)}</td><td>${badge(s.status)}</td></tr>`)):empty('Nenhum atendimento.')}<h2>Agenda operacional</h2>${d.agenda.length?table(['Serviço','Início','Fim','Status'],d.agenda.map(a=>`<tr><td>${esc(a.descricao)}</td><td>${date(a.inicioEm)}</td><td>${date(a.fimEm)}</td><td>${badge(a.status)}</td></tr>`)):empty('Nenhum agendamento.')}`;}
async function contas(){const d=await api('/contas');return `<div id="accounts-overview"><div class="stat-grid">${stat('Clientes cadastrados',d.totalClientes)}${stat('Contas no sistema',d.contas.length)}</div><h3>Usuários e último acesso</h3>${table(['Nome','E-mail','Perfil','Último acesso'],d.contas.map(c=>`<tr><td>${esc(c.nome)}</td><td>${esc(c.email)}</td><td>${esc(c.papel)}</td><td>${date(c.ultimoAcesso)}</td></tr>`))}</div><h3>Criar acesso</h3><form id="create-account" class="form-grid">${field('Nome','nome','text','required maxlength="120"')}${field('E-mail','email','email','required maxlength="254"')}${field('Senha (6 números)','senha','password','required minlength="6" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="new-password"')}${select('Perfil','papel','<option value="funcionario">Funcionário</option><option value="cliente">Cliente</option><option value="admin">Administrador</option>')}${select('Vincular ao cliente','clienteId','<option value="">Sem vínculo</option>'+state.clientes.map(c=>`<option value="${c.clienteId}">${esc(c.nome)}</option>`).join(''),false)}<button type="submit" class="primary">Criar conta</button><button type="reset" class="secondary">Cancelar</button><p id="account-error" class="form-error" role="alert"></p></form>`;}
function applyRole(){const role=state.session?.papel;document.querySelectorAll('.sidebar nav a').forEach(a=>a.hidden=role!=='admin');document.querySelector('.top-right span').textContent=role==='cliente'?'Olá, Cliente!':role==='funcionario'?'Olá, Funcionário!':'Olá, Administrador!';}

Object.assign(pageInfo,{ clientes:['Clientes','Todas as informações dos seus clientes, sempre por perto.','Novo cliente','cliente'],
 servicos:['Serviços','Acompanhe cada atendimento do início à conclusão.','Novo serviço','catalogo'],
 agenda:['Agenda','Organize suas visitas e acompanhe os próximos compromissos.','Agendar visita','agenda'],
 contas:['Contas e acessos','Gerencie funcionarios e clientes.']});
Object.assign(pages,{clientes,servicos,agenda,contas});
const operationalKinds=['cliente','endereco','catalogo','servico','agenda','status'];
const operationalFeature={
async form(kind,id){let title='',html='';
 if(kind==='servico'&&!state.clientes.length){toast('Cadastre um cliente primeiro.');kind='cliente';state.form={kind};}
 if(['agenda','status'].includes(kind)&&!state.servicos.length){toast('Cadastre um servico primeiro.');return;}
 if(kind==='catalogo'){title=id?'Editar serviço':'Novo serviço';html=field('Nome do Serviço','nome','text','required maxlength="120"',true)+'<label class="span2">Descrição (opcional)<textarea name="descricao" maxlength="500"></textarea></label>'+field('Preço Padrão em R$','precoPadrao','number','required min="0.01" max="9999999999.99" step="0.01"')+field('Duração (minutos)','duracaoMinutos','number','required min="1" max="1440" step="1"');}
 if(kind==='cliente'){title='Novo cliente';html=field('Nome completo','nome','text','required maxlength="120"',true)+field('Telefone (somente números)','telefone','tel','required pattern="[0-9]{10,15}" maxlength="15" placeholder="13999999999"')+field('E-mail (opcional)','email','email','maxlength="254"');}
 if(kind==='endereco'){title='Adicionar endereço';html=field('Logradouro','logradouro','text','required maxlength="120"',true)+field('Número','numero','text','required maxlength="20"')+field('Complemento (opcional)','complemento','text','maxlength="120"')+field('Bairro','bairro','text','required maxlength="120"')+field('Cidade','cidade','text','required maxlength="120"')+select('UF','uf', ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s=>`<option ${s==='SP'?'selected':''}>${s}</option>`).join(''))+field('CEP (somente números)','cep','text','required pattern="[0-9]{8}" maxlength="8"');}
 if(kind==='servico'){title='Novo atendimento';html=select('Cliente','clienteId',clientsOptions(),true,true)+select('Endereço (opcional)','enderecoId','<option value="">Selecione o cliente primeiro</option>',false,true)+select('Serviço do catálogo (opcional)','catalogoId','<option value="">Descrição livre</option>'+state.catalogo.map(c=>`<option value="${c.catalogoId}">${esc(c.nome)}</option>`).join(''),false,true)+description()+field('Valor previsto em R$ (opcional)','valorPrevisto','number','min="0.01" max="9999999999.99" step="0.01"');}
 if(kind==='servico')html+=field('Data do atendimento (opcional, para histórico)','dataAtendimento','date');
 if(kind==='agenda'){title='Agendar visita';const eligible=state.servicos.filter(s=>s.status==='registrado'&&s.catalogoId);if(!eligible.length){toast('A agenda precisa de um serviço com status Registrado.');return;}html=select('Serviço','servicoId','<option value="">Selecione um serviço</option>'+serviceOptions(eligible),true,true)+field('Início (horário de São Paulo)','inicioEm','datetime-local','required')+'<p class="help span2">O término será calculado automaticamente pela duração do serviço no catálogo.</p>'+'<p class="help span2">O serviço passa automaticamente para Agendado. Intervalos sobrepostos são recusados.</p>';}
 if(kind==='status'){
  title='Alterar status';const s=state.servicos.find(s=>s.servicoId===id),next={registrado:['em_andamento','cancelado'],agendado:['em_andamento','cancelado'],em_andamento:['concluido','cancelado']}[s.status]||[];
  if(!next.length){toast('Serviços concluídos ou cancelados não podem mudar de status.');return;}
  html=`<div class="span2"><strong>${esc(s.descricao)}</strong><p class="muted">${esc(clientName(s.clienteId))} · Atual: ${esc(labels[s.status])}</p></div>`+select('Novo status','status',next.map(v=>`<option value="${v}">${labels[v]}</option>`).join(''),true,true);
 }
 if(!title)return;return {title,html};
},
async defaults(kind,id){
 if(kind==='catalogo'&&id){const c=state.catalogo.find(c=>c.catalogoId===id);for(const key of ['nome','descricao','precoPadrao','duracaoMinutos'])$('#fields [name='+key+']').value=c[key]??'';}
},
async change(e){
  if(e.target.name==='catalogoId'&&state.form.kind==='servico'){const c=state.catalogo.find(c=>c.catalogoId===Number(e.target.value));if(c){$('#fields [name=descricao]').value=c.nome+(c.descricao?' — '+c.descricao:'');$('#fields [name=valorPrevisto]').value=c.precoPadrao;}}
  if(e.target.name==='clienteId'&&state.form.kind==='servico'){const id=e.target.value;const a=id?(await api(`/clientes/${id}/enderecos`)).enderecos:[];$('#fields [name=enderecoId]').innerHTML='<option value="">Sem endereço vinculado</option>'+a.map(a=>`<option value="${a.enderecoId}">${esc(a.logradouro)}, ${esc(a.numero)}</option>`).join('');}
},
destination(f,v){
 let path,method='POST';
 if(f.kind==='catalogo'){path='/catalogo-servicos'+(f.id?'/'+f.id:'');method=f.id?'PUT':'POST';}
 if(f.kind==='cliente')path='/clientes';if(f.kind==='endereco')path=`/clientes/${f.id}/enderecos`;if(f.kind==='servico')path='/servicos';if(f.kind==='agenda')path='/agendamentos';if(f.kind==='status'){path=`/servicos/${f.id}/status`;method='PATCH';}
 return {path,method};
}};
async function operationalAction(action,b,id){
 if(action==='tabcatalogo'||action==='tabatendimentos'){state.serviceTab=action==='tabcatalogo'?'catalogo':'atendimentos';await render();return true;}if(action==='day'){state.selectedDay=b.dataset.day;await render();return true;}if(action==='prevmonth'||action==='nextmonth'){const [y,m]=state.month.split('-').map(Number);state.month=new Date(Date.UTC(y,m-1+(action==='nextmonth'?1:-1),1)).toISOString().slice(0,7);state.selectedDay=state.month+'-01';await render();return true;}
 if(action==='detail'){state.cliente=id;await render();return true;}if(action==='backclientes'){state.cliente=null;await render();return true;}return false;
}
$('#content').addEventListener('input',e=>{if(e.target.id==='search'){const q=e.target.value.toLocaleLowerCase('pt-BR');$('#client-table').innerHTML=clientTable(state.clientes.filter(c=>[c.nome,c.telefone,c.email].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))));}});
$('#content').addEventListener('submit',async e=>{
 if(e.target.id==='create-account'){
  e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');
  if(button.disabled||!form.reportValidity())return;
  const v=Object.fromEntries(new FormData(form)),error=form.querySelector('#account-error');
  if(v.papel==='cliente'&&!v.clienteId){error.textContent='Vincule a conta a um cliente.';return;}
  if(v.papel!=='cliente')delete v.clienteId;else v.clienteId=Number(v.clienteId);
  button.disabled=true;button.textContent='Criando…';form.querySelector('[type=reset]').disabled=true;error.textContent='';
  try{await post('/contas',v);form.reset();await render();toast('Conta criada.');}
  catch(err){error.textContent=err.message;}
  finally{button.disabled=false;button.textContent='Criar conta';form.querySelector('[type=reset]').disabled=false;}
  return;
 }
 if(e.target.id!=='settings-form')return;e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;const f=new FormData(e.target),v={nomeEmpresa:f.get('nomeEmpresa')};for(const name of ['usarClientes','usarAgenda','usarOrcamentos','usarPagamentos'])v[name]=f.has(name);try{await post('/configuracoes',v,'PUT');await render();toast('Alterações salvas.');}catch(err){$('#settings-error').textContent=err.message;}finally{button.disabled=false;}
});
$('#content').addEventListener('reset',e=>{if(e.target.id==='create-account')e.target.querySelector('#account-error').textContent='';});
$('#content').addEventListener('input',e=>filterTable(e,{'catalog-search':[state.catalogo,c=>[c.nome,c.descricao],'#catalog-table',catalogTable]}));
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;$('#login-error').textContent='';try{state.session=await post('/sessao',Object.fromEntries(new FormData(e.target)));applyRole();e.target.reset();$('#login').hidden=true;$('#app').hidden=false;await render();}catch(e){$('#login-error').textContent=e.message;}finally{b.disabled=false;}});
$('#show-signup').addEventListener('click',()=>{$('#login').hidden=true;$('#signup').hidden=false;$('#signup-form [name=nome]').focus();});
$('#cancel-signup').addEventListener('click',()=>{$('#signup-form').reset();$('#signup-error').textContent='';$('#signup').hidden=true;$('#login').hidden=false;});
$('#signup-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');if(button.disabled||!form.reportValidity())return;
 const v=Object.fromEntries(new FormData(form));if(!v.complemento)delete v.complemento;
 button.disabled=true;$('#cancel-signup').disabled=true;$('#signup-error').textContent='';
 try{await post('/cadastro',v);form.reset();$('#signup').hidden=true;$('#login').hidden=false;$('#login-form [name=email]').value=v.email;toast('Conta criada. Entre com seu e-mail e senha.');}
 catch(err){$('#signup-error').textContent=err.message;}
 finally{button.disabled=false;$('#cancel-signup').disabled=false;}
});
document.querySelectorAll('.logout-button').forEach(button=>button.addEventListener('click',async()=>{try{await api('/sessao',{method:'DELETE'});$('#modal').close();loginScreen();toast('Sessão encerrada.');}catch(e){toast(e.message);}}));


'use strict';
// Financial features.
function pendingRows(rows){return rows.map(p=>`<tr><td><strong>${esc(p.nomeCliente)}</strong><small>${esc(p.descricao)}</small></td><td>${currency(p.valor)}</td><td>${badge(p.situacao)}</td><td><button class="table-action" data-action="pagamento" data-id="${p.servicoId}">Atualizar pagamento</button></td></tr>`);}
function quoteTable(items){return items.length?table(['Cliente','Serviço','Valor','Status','Ações'],items.map(o=>`<tr><td><strong>${esc(clientName(o.clienteId))}</strong></td><td>${esc(o.descricao)}</td><td>${currency(o.valorTotal)}</td><td>${badge(o.status)}</td><td><button class="table-action" data-action="quoteview" data-id="${o.orcamentoId}" aria-label="Visualizar orçamento ${o.orcamentoId}">◉ Visualizar</button></td></tr>`)):empty('Nenhum orçamento registrado.');}
async function orcamentos(){state.quotes=(await api('/financeiro/orcamentos')).orcamentos;return `<div class="toolbar"><input id="quote-search" placeholder="Buscar orçamento..." aria-label="Buscar orçamento"><button class="primary" data-action="orcamento">+ Novo orçamento</button></div><div id="quote-table">${quoteTable(state.quotes)}</div>`;}
const paymentState=p=>p.situacao==='pago'?'pago':p.vencimentoEm&&p.vencimentoEm<today()?'atrasado':'pendente';
function paymentTable(items){return items.length?table(['Cliente','Descrição','Valor','Status','Ação'],items.map(p=>`<tr><td><strong>${esc(p.nomeCliente)}</strong></td><td>${esc(p.descricao)}<small>Registro #${p.pagamentoId}${p.vencimentoEm?' · Vence em '+p.vencimentoEm.split('-').reverse().join('/'):''}</small></td><td>${currency(p.valor)}</td><td>${badge(paymentState(p))}</td><td><button class="table-action" data-action="${p.servicoId==null?'quote-payment':p.situacao==='pago'?'receipt':'collect'}" data-id="${p.pagamentoId}">${p.situacao==='pago'?'Recibo':'Cobrar'}</button>${p.servicoId==null?'':`<button class="subtle" data-action="pagamento" data-id="${p.servicoId}">Editar</button>`}</td></tr>`)):empty('Nenhum pagamento registrado.');}
async function pagamentos(){{const response=await api('/financeiro/pagamentos');state.payments=[...response.pagamentos,...(response.pagamentosOrcamento||[])];}const p=state.payments,sum=filter=>currency(p.filter(filter).reduce((v,p)=>v+Number(p.valor),0));return `<div class="stat-grid">${stat('Recebido este mês',sum(x=>x.situacao==='pago'&&dateISO(new Date(x.pagoEm)).slice(0,7)===today().slice(0,7)),'green')}${stat('Aguardando Liberação',sum(x=>paymentState(x)==='pendente'),'amber')}${stat('Atrasados',sum(x=>paymentState(x)==='atrasado'),'red')}</div><div class="toolbar"><input id="payment-search" placeholder="Buscar fatura ou cliente..." aria-label="Buscar pagamento"><button class="primary" data-action="pagamento">+ Registrar Recebimento</button></div><div id="payment-table">${paymentTable(p)}</div><p class="help">Recebimentos registrados manualmente. Atraso considera vencimento anterior a hoje. Sem emissão fiscal ou processamento bancário.</p>`;}
async function paymentDefaults(id){if(!id)return;const controls=[$('#fields [name=valor]'),$('#fields [name=situacao]'),$('#save-record')];controls.forEach(e=>e.disabled=true);try{const p=await api(`/financeiro/servicos/${id}/pagamento`);$('#fields [name=valor]').value=p.valor;$('#fields [name=situacao]').value=p.situacao;$('#fields [name=vencimentoEm]').value=p.vencimentoEm||'';}catch(e){if(e.status===404){$('#fields [name=valor]').value=state.servicos.find(s=>s.servicoId===Number(id))?.valorPrevisto||'';$('#fields [name=situacao]').value='pendente';}else $('#form-error').textContent=e.message;}finally{controls.forEach(e=>e.disabled=false);}}

Object.assign(pageInfo,{ orcamentos:['Orçamentos','Registre propostas e consulte os valores combinados.','Novo orçamento','orcamento'],
 pagamentos:['Pagamentos','Controle manual de valores recebidos e pendências.','Registrar Recebimento','pagamento'],
 pendencias:['Pendencias','Pagamentos pendentes e lembretes de visitas.']});
Object.assign(pages,{orcamentos,pagamentos,pendencias});
const financialFeature={
async form(kind,id){let title='',html='';
 if(kind==='orcamento'&&!state.clientes.length){toast('Cadastre um cliente antes de criar um orcamento.');return;}
 if(kind==='pagamento'&&!state.servicos.length){toast('Cadastre um servico antes de registrar um pagamento.');return;}
 if(kind==='quoteview'){const q=state.quotes.find(q=>q.orcamentoId===id);title='Orçamento #'+id;html=`<div class="span2"><p><strong>${esc(clientName(q.clienteId))}</strong></p><p>${esc(q.descricao)}</p><p>${currency(q.valorTotal)} · ${badge(q.status)}</p><p class="muted">Criado em ${date(q.criadoEm)}</p></div>`+(q.status==='pendente'?select('Decisão','status','<option value="aprovado">Aprovado</option><option value="recusado">Recusado</option>',true,true):'<p class="help span2">Decisão registrada. Para uma nova proposta, crie outro orçamento.</p>');}
 if(kind==='quote-payment'){const pay=state.payments.find(p=>p.pagamentoId===id&&p.servicoId==null);title='Pagamento do orçamento';html=`<div class="span2">${esc(pay.descricao)} — ${currency(pay.valor)}</div>`+select('Situação','situacao','<option value="pendente">Pendente</option><option value="pago">Pago</option>',true,true);}
 if(kind==='receipt'||kind==='collect'){const p=state.payments.find(p=>p.pagamentoId===id);title=kind==='receipt'?'Recibo de recebimento':'Mensagem de cobrança';const message=`Olá, ${p.nomeCliente}. Consta um pagamento pendente de ${currency(p.valor)} referente a ${p.descricao}.${p.vencimentoEm?' Vencimento: '+p.vencimentoEm.split('-').reverse().join('/')+'.':''}`;html=kind==='receipt'?`<div class="span2 receipt"><h3>${esc(state.config.nomeEmpresa)}</h3><p>Recebemos de <strong>${esc(p.nomeCliente)}</strong> o valor de <strong>${currency(p.valor)}</strong>, referente a ${esc(p.descricao)}.</p><p>Recebido em ${date(p.pagoEm)} · Registro #${p.pagamentoId}</p><p class="help">Comprovante de controle interno. Sem valor fiscal.</p></div>`:`<label class="span2">Copie e envie manualmente<textarea readonly rows="5">${esc(message)}</textarea></label><p class="help span2">Nenhuma mensagem é enviada automaticamente.</p>`;}
 if(kind==='orcamento'){title='Novo orçamento';html=select('Cliente','clienteId',clientsOptions(),true,true)+select('Serviço do catálogo','catalogoId','<option value="">Selecione um serviço</option>'+state.catalogo.map(c=>`<option value="${c.catalogoId}">${esc(c.nome)} — ${currency(c.precoPadrao)}</option>`).join(''),true,true)+description()+field('Valor total em R$','valorTotal','number','required min="0.01" max="9999999999.99" step="0.01"');}
 if(kind==='pagamento'){title='Registrar pagamento';html=select('Serviço','servicoId','<option value="">Selecione um serviço</option>'+serviceOptions(state.servicos),true,true)+field('Valor em R$','valor','number','required min="0.01" max="9999999999.99" step="0.01"')+select('Situação','situacao','<option value="pago">Confirmado</option><option value="pendente">Pendente</option>')+field('Vencimento (opcional)','vencimentoEm','date')+'<p class="help span2">Cada serviço possui um único registro de pagamento. Salvar atualiza esse registro.</p>';}
 if(!title)return;return {title,html,readOnly:['receipt','collect'].includes(kind)||(kind==='quoteview'&&state.quotes.find(q=>q.orcamentoId===id).status!=='pendente')};
},
async defaults(kind,id){
 if(kind==='pagamento'&&id){$('#fields [name=servicoId]').value=id;await paymentDefaults(id);}
},
async change(e){
  if(e.target.name==='servicoId'&&state.form.kind==='pagamento')await paymentDefaults(e.target.value);
 if(e.target.name==='catalogoId'&&state.form.kind==='orcamento'){const c=state.catalogo.find(c=>c.catalogoId===Number(e.target.value));if(c){$('#fields [name=descricao]').value=c.nome+(c.descricao?' - '+c.descricao:'');$('#fields [name=valorTotal]').value=c.precoPadrao;}}
},
destination(f,v){let path,method='POST';
 if(f.kind==='quote-payment'){path=`/financeiro/pagamentos-orcamento/${f.id}`;method='PATCH';}
 if(f.kind==='quoteview'){path=`/financeiro/orcamentos/${f.id}/status`;method='PATCH';}
 if(f.kind==='orcamento')path='/financeiro/orcamentos';
 if(f.kind==='pagamento'){path=`/financeiro/servicos/${v.servicoId}/pagamento`;delete v.servicoId;method='PUT';}
 return {path,method};
}};
$('#content').addEventListener('input',e=>filterTable(e,{'quote-search':[state.quotes,q=>[clientName(q.clienteId),q.descricao],'#quote-table',quoteTable],'payment-search':[state.payments,p=>[p.nomeCliente,p.descricao,p.pagamentoId],'#payment-table',paymentTable]}));
$('#content').addEventListener('change',async e=>{if(e.target.id!=='payment-lookup')return;const id=e.target.value;$('#payment-result').innerHTML='';if(!id)return;try{const p=await api(`/financeiro/servicos/${id}/pagamento`);$('#payment-result').innerHTML=`<div class="detail-line">${badge(p.situacao)} <strong>${currency(p.valor)}</strong>Atualizado em ${date(p.atualizadoEm)}${p.pagoEm?` · Pago em ${date(p.pagoEm)}`:''}</div><button class="secondary" data-action="pagamento" data-id="${Number(id)}">Atualizar registro</button>`;}catch(e){$('#payment-result').innerHTML=e.status===404?`<div class="detail-line">Nenhum pagamento registrado.</div><button class="secondary" data-action="pagamento" data-id="${Number(id)}">Registrar pagamento</button>`:`<p class="form-error">${esc(e.message)}</p>`;}});
async function pendencias(){
 const [p,l]=await Promise.all([api('/financeiro/pendencias'),api('/financeiro/lembretes')]);
 return panel('Pagamentos pendentes','',p.pendencias.length?table(['Cliente / servico','Valor','Situacao','Acao'],pendingRows(p.pendencias)):empty('Nenhum pagamento pendente.'))+
 panel('Lembretes de visitas','Proximas 24 horas',l.lembretes.length?table(['Cliente','Horario','Lembrete'],l.lembretes.map(x=>`<tr><td>${esc(x.nomeCliente)}</td><td>${date(x.inicioEm)}</td><td>${esc(x.mensagem)}</td></tr>`)):empty('Nenhum lembrete.'));
}


'use strict';
// Application startup.
(async()=>{try{state.session=await api('/sessao');applyRole();$('#login').hidden=true;$('#app').hidden=false;await render();}catch{loginScreen();}})();
