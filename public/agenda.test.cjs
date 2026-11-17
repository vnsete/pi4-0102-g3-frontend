const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
const elements = new Map();
function element(selector) {
  if (!elements.has(selector))
    elements.set(selector, {
      value: '',
      innerHTML: '',
      textContent: '',
      addEventListener(type, fn) {
        this.listener = fn;
      }
    });
  return elements.get(selector);
}
const sandbox = {
  document: { querySelector: element },
  fetch: async () => ({ status: 200, ok: true, json: async () => ({ autenticado: false }) }),
  console,
  Date
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/app.js', 'utf8'), sandbox);
(async () => {
  const now = new Date(),
    date = new Date(now.getFullYear(), now.getMonth(), 15, 14),
    start = vm.runInContext('localMinute', sandbox)(date);
  sandbox.events = [
    {
      inicio: start.replace('T', ' '),
      fim: start.slice(0, 11).replace('T', ' ') + '15:30',
      descricao: 'Limpeza <geral>',
      cliente: 'Maria'
    }
  ];
  vm.runInContext('req=async()=>events', sandbox);
  // Um serviço antigo mantém a data que já estava cadastrada.
  element('#fagenda [name="servico_id"]').value = '1';
  await sandbox.setupCalendar(
    [{ id: 1, duracao_minutos: 90, data_atendimento: start.slice(0, 10) }],
    sandbox.events
  );
  element('#fagenda [name="horario"]').value = '14:00';
  element('#fagenda [name="horario"]').oninput();
  assert.match(element('#calendario').innerHTML, /Limpeza &lt;geral&gt;/);
  assert.match(element('#calendario').innerHTML, /Maria/);
  assert.match(element('#calendario').innerHTML, /14:00 – 15:30/);
  assert.match(element('#previsaoFim').textContent, /15:30/);
  assert.equal(element('#fagenda [name="dia_servico"]').readOnly, true);
  assert.equal(element('[name="inicio"]').value, start);
  await sandbox.setupCalendar(
    [{ id: 1, duracao_minutos: 90, data_atendimento: '2000-01-01' }],
    sandbox.events
  );
  let stopped = false;
  element('#fagenda [name="horario"]').value = '14:00';
  element('#fagenda').listener({
    preventDefault() {},
    stopImmediatePropagation() {
      stopped = true;
    }
  });
  assert.ok(stopped);
  assert.match(element('#mensagem').textContent, /passado/);
  await sandbox.setupCalendar(
    [{ id: 1, duracao_minutos: 90, data_atendimento: start.slice(0, 10) }],
    sandbox.events
  );
  element('#mesAnterior').onclick();
  assert.doesNotMatch(element('#calendario').innerHTML, /Limpeza/);
  const budgets = sandbox.budgetTable([
    { id: 1, status: 'pendente' },
    { id: 2, status: 'aprovado' }
  ]);
  assert.match(budgets, /data-aprovar="1"/);
  assert.doesNotMatch(budgets, /data-aprovar="2"/);
  sandbox.events = [
    {
      inicio: start.replace('T', ' '),
      fim: start.replace('T', ' '),
      descricao: 'Serviço sem horário',
      cliente: 'Maria',
      sem_horario: 1
    }
  ];
  // Depois de aprovar um orçamento, o dia fica livre para o usuário escolher.
  await sandbox.setupCalendar(
    [{ id: 1, duracao_minutos: 90, orcamento_aprovado: 1 }],
    sandbox.events
  );
  const day = element('#fagenda [name="dia_servico"]');
  assert.equal(day.readOnly, false);
  assert.equal(day.value, '');
  day.value = start.slice(0, 10);
  element('#fagenda [name="horario"]').value = '14:00';
  day.oninput();
  assert.equal(element('[name="inicio"]').value, start);
  assert.match(element('#calendario').innerHTML, /Horário a definir/);
  console.log('Calendário, duração, bloqueio de datas, navegação e aprovação: OK');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
