# Visão Geral do Sistema - ServiHUB

## Tabela de Módulos
| Módulo | O que faz | Tecnologia | Repositório | Responsável |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Telas de gestão e navegação do prestador | React | `pi4-0102-g3-frontend` | Samuel Henrique do Nascimento Pereira /  João Victor Pensado |
| **Backend 1** | Gerencia clientes, endereços, serviços e agendamentos | Java | `pi4-0102-g3-backend-1` | Felipe Bianco Gaya dos Santos  / Thiago Viel Denadai|
| **Backend 2** | Gerencia orçamentos, pagamentos e notificações | Java | `pi4-0102-g3-backend-2` | Felipe Bianco Gaya dos Santos  / Thiago Viel Denadai|
| **Banco de Dados** | Armazena dados relacionais de clientes, serviços e ordens | PostgreSQL | Compartilhado c/ Backend 1 | Breno Masiesque / Vinícius Logatto Costa Sete |
## Convenção de Nomes
Nas mensagens e requisições entre módulos usamos camelCase (ex: `clienteId`, `dataAgendamento`). No banco de dados usamos snake_case (ex: `cliente_id`, `data_agendamento`). Nomes de operações HTTP seguem o padrão de verbo no infinitivo + objeto (ex: `cadastrarCliente`, `listarServicos`).
## Diagrama de Contêineres (C4 - Nível 2)
```mermaid
flowchart TB
    prestador(["Prestador de Serviços"])

    subgraph servihub ["Sistema ServiHUB"]
        direction TB
        frontend["Frontend<br/>React<br/>Painel de Gestão"]
        backend1["Backend 1<br/>Java / Spring Boot<br/>Clientes, Serviços e Agenda"]
        backend2["Backend 2<br/>Java / Spring Boot<br/>Orçamentos, Pagamentos e Avisos"]
        banco[("Banco de Dados<br/>PostgreSQL<br/>Repositório Relacional")]
    end

    prestador -->|Usa via navegador| frontend
    frontend -->|Requisições HTTP<br/>Clientes, Serviços, Agenda| backend1
    frontend -->|Requisições HTTP<br/>Orçamentos e Pagamentos| backend2
    backend1 -->|Persistência SQL<br/>Leitura e Gravação| banco
    backend2 -.->|Notificações e Lembretes<br/>Avisos de pendências| frontend
