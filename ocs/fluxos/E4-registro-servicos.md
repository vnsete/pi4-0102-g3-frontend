# Fluxo do E4: Registro de Serviços

**Feito quando:** O prestador registra um novo serviço vinculado a um cliente, informa os dados do atendimento e ele passa a aparecer na lista de serviços.

## Passos
1. O prestador acessa a tela de serviços no Frontend e seleciona um cliente previamente cadastrado.
2. O prestador preenche a descrição do atendimento e define a etapa inicial do serviço (ex: aguardando peça ou em execução).
3. O Frontend envia uma requisição HTTP POST para o Backend 1 usando a operação `cadastrarServico` (CT4).
4. O Backend 1 valida se o ID do cliente informado realmente existe e se os dados do serviço estão válidos.
5. O Backend 1 grava a nova ordem de atendimento na tabela de ordens de serviço do banco de dados (CT5).
6. O Banco de Dados confirma o registro com sucesso para o Backend 1.
7. O Backend 1 responde ao Frontend com os detalhes da ordem de serviço criada.
8. O Frontend atualiza a tela exibindo o novo serviço na listagem geral do prestador.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend1 as Backend 1
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: preenche dados do serviço e clica em salvar
    Frontend->>Backend1: POST /servicos (CT4)
    Backend1->>Banco: INSERT INTO ordem_servico (CT5)
    Banco-->>Backend1: confirmação de gravação
    Backend1-->>Frontend: resposta de sucesso com o serviço criado
    Frontend-->>Prestador: exibe serviço cadastrado na listagem
