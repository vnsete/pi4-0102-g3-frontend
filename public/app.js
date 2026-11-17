// Estas são as telas do menu. Cada tela carrega os dados que vêm do servidor.
const api = '/api/',
  api2 = '/api2/';
const $ = (s) => document.querySelector(s);
const sections = [
  'Dashboard',
  'Clientes',
  'Serviços',
  'Agenda',
  'Orçamentos',
  'Pagamentos',
  'Pendências'
];
let current = 'Dashboard';
let calendarFocus = '';
async function req(path, method = 'GET', data, second = false) {
  const r = await fetch((second ? api2 : api) + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: data ? JSON.stringify(data) : undefined
  });
  const j = await r.json();
  if (r.status === 401) {
    if (path === 'sessao' && method === 'POST') throw Error('E-mail ou senha incorretos.');
    showLogin();
    $('#loginMsg').textContent = 'Sua sessão expirou. Entre novamente.';
    throw Error('Sua sessão expirou. Entre novamente.');
  }
  if (!r.ok) throw Error(j.erro || 'Erro');
  return j;
}
function showLogin() {
  $('#login').hidden = false;
  $('#app').hidden = true;
}
function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
}
function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
function options(rows, field = 'nome') {
  return rows
    .map((r) => `<option value="${r.id}">${esc(r[field] || r.descricao || r.id)}</option>`)
    .join('');
}
function table(rows) {
  if (!rows.length) return '<p>Nenhum registro encontrado.</p>';
  const keys = Object.keys(rows[0]);
  return `<table><thead><tr>${keys.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${keys.map((k) => `<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function form(id, fields, button) {
  return `<form class="box" id="${id}"><div class="formgrid">${fields.map(([name, label, type, opts]) => `<label>${label}${type === 'select' ? `<select name="${name}" required>${opts}</select>` : `<input name="${name}" type="${type || 'text'}" ${['email', 'complemento', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'endereco_id', 'servico_id', 'data_pagamento', 'valor_previsto', 'data_atendimento'].includes(name) ? '' : 'required'}>`}</label>`).join('')}<button>${button}</button></div></form>`;
}

// Depois de salvar, a tela é recarregada para mostrar os dados atualizados.
function bind(id, path, method = 'POST') {
  const el = $('#' + id);
  if (!el) return;
  el.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(el));
    for (const k in data) if (data[k] === '') delete data[k];
    if (id === 'fagenda') {
      delete data.dia_servico;
      delete data.horario;
    }
    try {
      await req(typeof path === 'function' ? path(data) : path, method, data);
      if (id === 'fagenda') {
        calendarFocus = data.inicio;
        await render('Agenda');
      } else await render(current);
      $('#mensagem').textContent =
        {
          fcliente: 'Cliente cadastrado. Com um item no catálogo, você já pode criar um orçamento.',
          fcatalogo: 'Item cadastrado. Se o cliente já estiver cadastrado, vá em Orçamentos.',
          forc: 'Orçamento criado. Use o botão de aprovação quando o cliente confirmar.',
          fagenda: 'Atendimento agendado. A data do pagamento pode ser informada em Pagamentos.',
          fpag: 'Pagamento atualizado.'
        }[id] || 'Registro salvo.';
    } catch (ex) {
      $('#mensagem').textContent = ex.message;
    }
  };
}
async function render(page, serviceId) {
  current = page;
  $('#titulo').textContent = page;
  $('#mensagem').textContent = '';
  const c = $('#conteudo');
  let agendaEvents;
  c.innerHTML = 'Carregando...';
  try {
    const clients = await req('clientes');
    const clientOpts = options(clients),
      services = await req('servicos'),
      servOpts = options(
        services.map((service) => ({
          ...service,
          nome: service.descricao + ' — ' + service.cliente
        }))
      ),
      catalog = await req('catalogo');
    let html = '';
    if (page === 'Dashboard') {
      const [agenda, pend, lemb] = await Promise.all([
        req('agenda'),
        req('pendencias'),
        req('lembretes', 'GET', null, true)
      ]);
      html = `<p>Cadastre o cliente e o item do catálogo. Depois, crie e aprove o orçamento para agendar o atendimento.</p><div class="box"><h3>Serviços agendados</h3>${table(agenda)}</div><div class="box"><h3>Lembretes de visitas (próximas 24 horas)</h3>${table(lemb)}</div><div class="box"><h3>Pagamentos pendentes</h3>${table(pend)}</div>`;
    }
    if (page === 'Clientes') {
      html =
        form(
          'fcliente',
          [
            ['nome', 'Nome'],
            ['telefone', 'Telefone com DDD', 'tel'],
            ['email', 'E-mail', 'email']
          ],
          'Cadastrar cliente'
        ) +
        `<div class="box"><h3>Clientes</h3>${table(clients)}</div>` +
        form(
          'fend',
          [
            ['cliente_id', 'Cliente', 'select', clientOpts],
            ['logradouro', 'Logradouro'],
            ['numero', 'Número'],
            ['complemento', 'Complemento'],
            ['bairro', 'Bairro'],
            ['cidade', 'Cidade'],
            ['estado', 'Estado'],
            ['cep', 'CEP']
          ],
          'Cadastrar endereço'
        ) +
        `<div class="box"><h3>Consultar endereços e histórico</h3><select id="clienteSelecionado">${clientOpts}</select><button id="consultarCliente">Consultar</button><div id="detalhes"></div></div>`;
    }
    if (page === 'Serviços') {
      html =
        form(
          'fcatalogo',
          [
            ['descricao', 'Produto ou serviço do catálogo'],
            ['duracao_minutos', 'Duração (minutos)', 'number'],
            ['valor', 'Valor', 'number']
          ],
          'Adicionar ao catálogo'
        ) +
        `<div class="box"><h3>Catálogo de serviços</h3>${table(catalog)}</div>` +
        `<div class="box"><h3>Serviços</h3>${table(services.map(({ orcamento_aprovado, ...service }) => service))}</div>` +
        form(
          'fstatus',
          [
            ['servico_id', 'Serviço', 'select', servOpts],
            [
              'status',
              'Novo status',
              'select',
              '<option value="em_andamento">Em andamento</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option>'
            ]
          ],
          'Alterar status'
        );
    }
    if (page === 'Agenda') {
      agendaEvents = await req('agenda');
      const pending = services.filter(
        (service) =>
          ['registrado', 'agendado'].includes(service.status) &&
          (Number(service.orcamento_aprovado) || service.data_atendimento) &&
          !agendaEvents.some(
            (event) => String(event.servico_id) === String(service.id) && !Number(event.sem_horario)
          )
      );
      const choices =
        '<option value="">Selecione um atendimento</option>' +
        options(
          pending.map((service) => ({
            ...service,
            nome: service.descricao + ' — ' + service.cliente
          }))
        );
      html =
        (pending.length
          ? form(
              'fagenda',
              [
                ['servico_id', 'Atendimento', 'select', choices],
                ['dia_servico', 'Data do atendimento', 'date'],
                ['horario', 'Horário de início', 'time']
              ],
              'Agendar atendimento'
            )
          : '<p>Nenhum serviço aguardando agendamento. Aprove um orçamento para marcar um atendimento.</p>') +
        `<p id="previsaoFim"></p><div class="box" id="calendario"></div>`;
      if (pending.length)
        html = html.replace('</form>', '<input type="hidden" name="inicio"></form>');
    }
    if (page === 'Orçamentos') {
      const missing = [
        !clients.length && 'um cliente em Clientes',
        !catalog.length && 'um item do catálogo em Serviços'
      ].filter(Boolean);
      html =
        (missing.length
          ? `<p>Para criar um orçamento, cadastre ${missing.join(' e ')}.</p>`
          : form(
              'forc',
              [
                ['cliente_id', 'Cliente', 'select', clientOpts],
                ['catalogo_id', 'Produto ou serviço do catálogo', 'select', options(catalog)],
                ['valor', 'Valor', 'number']
              ],
              'Criar orçamento'
            )) + `<div class="box">${budgetTable(await req('orcamentos'))}</div>`;
    }
    if (page === 'Pagamentos') {
      html =
        '<p>Você pode atualizar a data do pagamento antes ou depois de agendar o atendimento.</p>' +
        form(
          'fpag',
          [
            ['servico_id', 'Serviço', 'select', servOpts],
            ['valor', 'Valor', 'number'],
            [
              'situacao',
              'Situação',
              'select',
              '<option value="pendente">Pendente</option><option value="pago">Pago</option>'
            ],
            ['data_pagamento', 'Data do pagamento (opcional)', 'date']
          ],
          'Registrar pagamento'
        ) +
        `<div class="box">${table(await req('pagamentos'))}</div>`;
    }
    if (page === 'Pendências') {
      html = `<div class="box">${table(await req('pendencias'))}</div>`;
    }
    c.innerHTML = html;
    if (page === 'Agenda') {
      const serviceSelect = $('#fagenda [name="servico_id"]');
      if (serviceSelect && serviceId) serviceSelect.value = serviceId;
      await setupCalendar(services, agendaEvents);
    }
    bind('fcatalogo', 'catalogo');
    configureFields(catalog);

    // Aprovar gera um serviço. Já abrimos a Agenda com esse atendimento selecionado.
    c.querySelectorAll('[data-aprovar]').forEach(
      (btn) =>
        (btn.onclick = async () => {
          btn.disabled = true;
          try {
            const approved = await req(`orcamentos/${btn.dataset.aprovar}/aprovar`, 'PUT', {});
            await render('Agenda', approved.servico_aprovado_id);
            $('#mensagem').textContent =
              'Orçamento aprovado. Escolha a data e o horário do atendimento.';
          } catch (e) {
            $('#mensagem').textContent = e.message;
            btn.disabled = false;
          }
        })
    );
    bind('fcliente', 'clientes');
    bind('fend', (d) => `clientes/${d.cliente_id}/enderecos`);
    bind('fagenda', 'agendamentos');
    bind('forc', 'orcamentos');
    bind('fpag', 'pagamentos');
    bind('fstatus', (d) => `servicos/${d.servico_id}/status`, 'PUT');
    const btn = $('#consultarCliente');
    if (btn)
      btn.onclick = async () => {
        let id = $('#clienteSelecionado').value;
        try {
          let [a, b] = await Promise.all([
            req(`clientes/${id}/enderecos`),
            req(`clientes/${id}/historico`)
          ]);
          $('#detalhes').innerHTML =
            '<h3>Endereços</h3>' + table(a) + '<h3>Histórico de serviços</h3>' + table(b);
        } catch (e) {
          $('#mensagem').textContent = e.message;
        }
      };
  } catch (e) {
    c.textContent = e.message;
  }
}
$('#menu').innerHTML = sections.map((x) => `<button data-page="${x}">${x}</button>`).join('');
$('#menu').onclick = (e) => {
  const p = e.target.dataset.page;
  if (p) render(p);
};
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await req('sessao', 'POST', Object.fromEntries(new FormData(e.target)));
    showApp();
    render('Dashboard');
  } catch (ex) {
    $('#loginMsg').textContent = ex.message;
  }
};
$('#sair').onclick = async () => {
  await req('sessao', 'DELETE');
  showLogin();
};
req('sessao')
  .then((s) => {
    if (s.autenticado) {
      showApp();
      render('Dashboard');
    } else showLogin();
  })
  .catch(showLogin);

function localMinute(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function configurePhone() {
  const phone = $('#fcliente [name="telefone"]');
  if (!phone) return;
  phone.inputMode = 'numeric';
  phone.minLength = 10;
  phone.maxLength = 11;
  phone.pattern = '[0-9]{10,11}';
  phone.placeholder = 'DDD + número';
  phone.title = 'Informe 10 ou 11 números, incluindo o DDD.';
  phone.oninput = () => {
    phone.value = phone.value.replace(/[^0-9]/g, '').slice(0, 11);
    phone.setCustomValidity(
      phone.value && !/^[0-9]{10,11}$/.test(phone.value)
        ? 'Informe 10 ou 11 números, incluindo o DDD.'
        : ''
    );
  };
  phone.oninput();
}
// Cada orçamento pendente tem seu próprio botão de aprovação.
function budgetTable(rows) {
  return (
    table(rows) +
    rows
      .filter((r) => r.status !== 'aprovado')
      .map(
        (r) =>
          `<button data-aprovar="${r.id}">Aprovar orçamento #${r.id} — ${esc(r.cliente)}</button>`
      )
      .join('')
  );
}
function configureFields(catalog) {
  document.querySelectorAll('input[type="number"]').forEach((input) => {
    input.min = input.name === 'duracao_minutos' ? '1' : '0';
    input.step = input.name === 'duracao_minutos' ? '1' : '0.01';
  });
  configurePhone();
  const select = $('[name="catalogo_id"]');
  if (select) {
    const update = () => {
      const item = catalog.find((s) => String(s.id) === select.value);
      if (item) $('[name="valor"]').value = item.valor;
    };
    select.onchange = update;
    update();
  }
  const payment = $('#fpag');
  if (payment) {
    const update = async () => {
      try {
        const rows = await req('pagamentos');
        if ($('#fpag') !== payment) return;
        const row = rows.find((p) => String(p.servico_id) === payment.elements.servico_id.value);
        payment.elements.valor.value = row ? row.valor : '';
        payment.elements.situacao.value = row ? row.situacao : 'pendente';
        payment.elements.data_pagamento.value = row && row.data_pagamento ? row.data_pagamento : '';
      } catch (e) {
        $('#mensagem').textContent = e.message;
      }
    };
    payment.elements.servico_id.onchange = update;
    update();
  }
}
// A Agenda calcula o término usando a duração que veio do catálogo.
async function setupCalendar(services, events) {
  const agenda = $('#fagenda');
  if (agenda) {
    const input = $('[name="inicio"]');
    const select = $('#fagenda [name="servico_id"]');
    const day = $('#fagenda [name="dia_servico"]');
    const time = $('#fagenda [name="horario"]');
    const preview = () => {
      const service = services.find((item) => String(item.id) === select.value);
      const today = localMinute(new Date());
      day.min = today.slice(0, 10);
      time.min = day.value === day.min ? today.slice(11, 16) : '';
      input.value = service && day.value && time.value ? day.value + 'T' + time.value : '';
      $('#previsaoFim').textContent = input.value
        ? 'Término previsto: ' +
          new Date(
            new Date(input.value).getTime() + Number(service.duracao_minutos) * 60000
          ).toLocaleString('pt-BR')
        : 'O término será calculado pela duração do serviço.';
    };
    const pickService = () => {
      const service = services.find((item) => String(item.id) === select.value);
      // Serviços antigos com data prevista ainda usam o dia que já estava cadastrado.
      day.readOnly = Boolean(
        service && service.data_atendimento && !Number(service.orcamento_aprovado)
      );
      day.value = day.readOnly ? String(service.data_atendimento).slice(0, 10) : '';
      time.value = '';
      preview();
    };
    select.onchange = pickService;
    day.oninput = time.oninput = time.onfocus = preview;
    pickService();
    agenda.addEventListener(
      'submit',
      (e) => {
        preview();
        if (!input.value || input.value < localMinute(new Date())) {
          e.preventDefault();
          e.stopImmediatePropagation();
          $('#mensagem').textContent = input.value
            ? 'Não é permitido agendar no passado.'
            : 'Selecione o atendimento, a data e o horário.';
        }
      },
      true
    );
  }

  // O calendário mostra o mês do último agendamento e permite navegar entre meses.
  let month = calendarFocus ? new Date(calendarFocus.slice(0, 10) + 'T12:00') : new Date();
  month.setDate(1);
  const draw = () => {
    const today = localMinute(new Date()).slice(0, 10),
      year = month.getFullYear(),
      m = month.getMonth(),
      offset = new Date(year, m, 1).getDay(),
      days = new Date(year, m + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<div class="calendar-empty"></div>';
    for (let day = 1; day <= days; day++) {
      const key = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const entries = events.filter(
        (e) => String(e.inicio).slice(0, 10) <= key && String(e.fim).slice(0, 10) >= key
      );
      cells += `<div class="calendar-day ${key < today ? 'past' : ''} ${key === today ? 'today' : ''}"><time datetime="${key}">${day}</time>${entries.map((e) => `<div class="calendar-event"><strong>${esc(e.descricao)}</strong><span>${esc(e.cliente)}</span><span>${Number(e.sem_horario) ? 'Horário a definir' : esc(String(e.inicio).slice(11, 16)) + ' – ' + esc(String(e.fim).slice(11, 16))}</span></div>`).join('')}</div>`;
    }
    $('#calendario').innerHTML =
      `<div class="calendar-toolbar"><button type="button" id="mesAnterior" aria-label="Mês anterior">‹</button><h3 aria-live="polite">${esc(month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h3><button type="button" id="proximoMes" aria-label="Próximo mês">›</button></div><p>Atendimentos agendados · Datas passadas indisponíveis para novos agendamentos.</p><div class="calendar-grid">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => '<strong>' + d + '</strong>').join('')}${cells}</div>`;
    $('#mesAnterior').onclick = () => {
      month.setMonth(month.getMonth() - 1);
      draw();
    };
    $('#proximoMes').onclick = () => {
      month.setMonth(month.getMonth() + 1);
      draw();
    };
  };
  draw();
}
