# Fluxo do E10: Aviso de Pendências

**Feito quando:** O prestador consulta os registros e o sistema sinaliza quais pagamentos ainda estão pendentes.

## Passos
1. O prestador acessa a tela de resumo financeiro ou dashboard principal no Frontend.
2. O Frontend envia uma requisição HTTP GET para o **Backend 2** com a operação `consultarPendencias` (CT9).
3. O Backend 2 consulta no banco de dados todos os registros de pagamentos ou orçamentos cujos status estejam marcados como pendentes ou em aberto.
4. O Banco de Dados retorna a lista de valores e clientes com pendências financeiras.
5. O Backend 2 consolida os dados e responde ao Frontend com o resumo das pendências.
6. O Frontend exibe um painel de avisos destacado com a listagem de pagamentos pendentes para o prestador acompanhar.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend2 as Backend 2
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: acessa o painel financeiro / dashboard
    Frontend->>Backend2: GET /pagamentos/pendentes (CT9)
    Backend2->>Banco: SELECT * FROM pagamento WHERE status = 'pendente'
    Banco-->>Backend2: retorna lista de pendências financeiras
    Backend2-->>Frontend: dados consolidados das pendências
    Frontend-->>Prestador: exibe alertas visuais de pagamentos pendentes
