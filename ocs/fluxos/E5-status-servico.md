# Fluxo do E5: Status do Serviço

**Feito quando:** O prestador altera o status de um serviço e a nova situação fica registrada e visível no acompanhamento do atendimento.

## Passos
1. O prestador visualiza um serviço em andamento no Frontend e clica para alterar sua etapa/status atual (ex: de "aguardando peça" para "em execução" ou "pronto").
2. O Frontend envia uma requisição HTTP PATCH para o Backend 1 usando a operação `atualizarStatusServico` (CT5).
3. O Backend 1 valida se a ordem de serviço existe e se o novo status enviado é permitido pelas regras de negócio.
4. O Backend 1 atualiza o registro correspondente na tabela de ordens de serviço do banco de dados, modificando a etapa e a data de atualização.
5. O Banco de Dados confirma a alteração.
6. O Backend 1 responde ao Frontend com a confirmação e os dados atualizados.
7. O Frontend atualiza visualmente o card ou linha do serviço na tela do prestador e dispara um aviso interno (via Backend 2) caso o serviço esteja concluído.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend1 as Backend 1
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: altera o status do serviço na interface
    Frontend->>Backend1: PATCH /servicos/{id}/etapa (CT5)
    Backend1->>Banco: UPDATE ordem_servico SET etapa = novo_status
    Banco-->>Backend1: confirmação da atualização
    Backend1-->>Frontend: resposta com o serviço atualizado
    Frontend-->>Prestador: exibe o status atualizado em tempo real
