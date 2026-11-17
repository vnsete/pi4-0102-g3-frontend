const fs = require('node:fs'),
  assert = require('node:assert/strict'),
  { execFileSync } = require('node:child_process');
const config = Object.fromEntries(
  fs
    .readFileSync(__dirname + '/../.env', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    })
);
let cookie = '',
  clientId,
  serviceId;
async function request(path, method = 'GET', data) {
  const response = await fetch('http://localhost:3000/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: data ? JSON.stringify(data) : undefined
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return { status: response.status, data: await response.json() };
}
(async () => {
  try {
    assert.equal(
      (await request('sessao', 'POST', { email: config.ADMIN_EMAIL, senha: config.ADMIN_PASSWORD }))
        .status,
      200
    );
    for (const route of ['lembretes', 'pendencias']) {
      const url = 'http://localhost:3000/api2/' + route;
      assert.equal((await fetch(url)).status, 401, 'Integração deve exigir sessão');
      const response = await fetch(url, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, 'Integração deve aceitar sessão válida');
      assert.ok(Array.isArray(await response.json()));
      assert.equal((await fetch(url, { method: 'POST', headers: { Cookie: cookie } })).status, 405);
    }
    const client = await request('clientes', 'POST', {
      nome: 'Teste temporário da agenda',
      telefone: '11999999999'
    });
    assert.equal(client.status, 201);
    clientId = client.data.id;
    const service = {
      cliente_id: clientId,
      descricao: 'Teste temporário da agenda',
      duracao_minutos: 90,
      data_atendimento: '2000-01-01'
    };
    assert.equal((await request('servicos', 'POST', service)).status, 400);
    service.data_atendimento = '2099-11-20';
    const created = await request('servicos', 'POST', service);
    assert.equal(created.status, 201);
    serviceId = created.data.id;
    let agenda = (await request('agenda')).data;
    let event = agenda.find((e) => e.servico_id === serviceId);
    assert.ok(event);
    assert.equal(Number(event.sem_horario), 1);
    assert.match(event.inicio, /2099-11-20/);
    assert.equal(
      (await request('agendamentos', 'POST', { servico_id: serviceId, inicio: '2000-01-01T10:00' }))
        .status,
      400
    );
    assert.equal(
      (await request('agendamentos', 'POST', { servico_id: serviceId, inicio: '2099-11-21T10:00' }))
        .status,
      400
    );
    let date = new Date('2099-11-20T00:00:00Z');
    while (
      agenda.some(
        (e) =>
          !Number(e.sem_horario) &&
          e.inicio.replace(' ', 'T').slice(0, 16) <=
            new Date(date.getTime() + 90 * 60000).toISOString().slice(0, 16) &&
          e.fim.replace(' ', 'T').slice(0, 16) >= date.toISOString().slice(0, 16)
      )
    )
      date = new Date(date.getTime() + 90 * 60000);
    assert.equal(date.toISOString().slice(0, 10), '2099-11-20');
    const start = date.toISOString().slice(0, 16);
    assert.equal(
      (await request('agendamentos', 'POST', { servico_id: serviceId, inicio: start })).status,
      201
    );
    agenda = (await request('agenda')).data;
    const events = agenda.filter((e) => e.servico_id === serviceId);
    assert.equal(events.length, 1);
    assert.equal(Number(events[0].sem_horario), 0);
    assert.equal(
      new Date(events[0].fim.replace(' ', 'T')) - new Date(events[0].inicio.replace(' ', 'T')),
      90 * 60000
    );
    console.log(
      'API: passado bloqueado, serviço datado visível, horário calculado e evento sem duplicação: OK'
    );
  } finally {
    if (clientId) {
      const sql =
        (serviceId
          ? `DELETE FROM agendamento WHERE servico_id=${Number(serviceId)}; DELETE FROM servico WHERE id=${Number(serviceId)};`
          : '') + `DELETE FROM cliente WHERE id=${Number(clientId)};`;
      execFileSync(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'mysql',
          'mysql',
          '-uservihub',
          '-pservihub_local',
          'servihub_pdf',
          '-e',
          sql
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
