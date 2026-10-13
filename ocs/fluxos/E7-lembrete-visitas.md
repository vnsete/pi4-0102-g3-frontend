# Fluxo do E7: Lembrete de Visitas

**Feito quando:** O sistema identifica um atendimento agendado e apresenta ao prestador um lembrete referente à visita.

## Passos
1. O sistema (através de uma rotina agendada no Backend 2) monitora os horários dos compromissos salvos no banco de dados.
2. Ao detectar que um atendimento agendado está próximo (ex: no mesmo dia ou com antecedência configurada), o Backend 2 gera um alerta de lembrete.
3. O Backend 2 envia o alerta interno para o Backend 1 ou armazena a notificação de pendência.
4. O Frontend consulta periodicamente ou recebe via atualização de estado os avisos pendentes através de uma requisição HTTP GET para o Backend 2.
5. O Frontend exibe um destaque visual ou pop-up de lembrete de visita diretamente no painel de controle do prestador.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    participant Backend2 as Backend 2 (Rotina)
    participant Banco as Banco de Dados
    participant Frontend as Frontend
    actor Prestador as Prestador
    
    Backend2->>Banco: consulta agendamentos próximos do horário atual
    Banco-->>Backend2: retorna lista de compromissos pendentes
    Frontend->>Backend2: GET /notificacoes/lembretes
    Backend2-->>Frontend: retorna os lembretes de visitas do dia
    Frontend-->>Prestador: exibe o aviso/lembrete de visita em destaque na tela
