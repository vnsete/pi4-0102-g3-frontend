# Fluxo do E3: Histórico de Serviços por Cliente

**Feito quando:** O prestador acessa o cadastro de um cliente e visualiza os serviços anteriormente registrados para ele.

## Passos
1. O prestador clica sobre o perfil de um cliente específico na listagem do Frontend.
2. O Frontend envia uma requisição HTTP GET para o Backend 1 solicitando o histórico do cliente através da operação `consultarHistorico` (CT3).
3. O Backend 1 consulta o banco de dados buscando todas as ordens de serviço e atendimentos vinculados àquele ID de cliente.
4. O Banco de Dados retorna os registros encontrados.
5. O Backend 1 formata os dados e responde ao Frontend com a lista completa do histórico de atendimentos.
6. O Frontend renderiza as informações organizadas em ordem cronológica na tela do cliente.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend1 as Backend 1
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: clica no perfil do cliente
    Frontend->>Backend1: GET /clientes/{id}/servicos (CT3)
    Backend1->>Banco: SELECT * FROM ordem_servico WHERE cliente_id = id
    Banco-->>Backend1: retorna lista de serviços do cliente
    Backend1-->>Frontend: dados consolidados do histórico
    Frontend-->>Prestador: exibe histórico de serviços na tela
