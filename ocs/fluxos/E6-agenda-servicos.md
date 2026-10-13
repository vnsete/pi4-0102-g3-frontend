# Fluxo do E6: Agenda de Serviços

**Feito quando:** O prestador agenda um atendimento com data e horário e ele passa a aparecer na agenda do sistema.

## Passos
1. O prestador acessa a aba de agenda no Frontend e clica em "Agendar Atendimento", informando o cliente, a descrição, a data e o horário.
2. O Frontend envia uma requisição HTTP POST para o Backend 1 com a operação `agendarServico` (CT6).
3. O Backend 1 valida os dados de data/horário e verifica se o cliente informado é válido.
4. O Backend 1 insere o novo compromisso agendado na tabela de agenda/serviços do banco de dados.
5. O Banco de Dados confirma o salvamento do agendamento.
6. O Backend 1 responde ao Frontend confirmando o sucesso da operação.
7. O Frontend renderiza o novo compromisso na visualização de calendário/agenda do prestador.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend1 as Backend 1
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: define data, hora e salva o agendamento
    Frontend->>Backend1: POST /agendamentos (CT6)
    Backend1->>Banco: INSERT INTO agendamento (data, hora, cliente_id)
    Banco-->>Backend1: confirmação de gravação
    Backend1-->>Frontend: resposta de sucesso com dados do compromisso
    Frontend-->>Prestador: exibe o compromisso na agenda visual
