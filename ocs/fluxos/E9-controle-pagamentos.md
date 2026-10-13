# Fluxo do E9: Controle de Pagamentos

**Feito quando:** O prestador registra manualmente o valor e a situação do pagamento de um atendimento e consegue identificar se ele foi pago ou permanece pendente.

## Passos
1. O prestador acessa o detalhe de um serviço ou orçamento no Frontend e clica em "Registrar Pagamento".
2. O prestador informa o valor pago, a forma de pagamento e altera a situação (ex: de "pendente" para "pago").
3. O Frontend envia uma requisição HTTP POST/PATCH para o **Backend 2** utilizando a operação `registrarPagamento` (CT8).
4. O Backend 2 valida os dados financeiros e atualiza a situação do pagamento na tabela correspondente do banco de dados.
5. O Banco de Dados confirma a atualização do registro financeiro.
6. O Backend 2 retorna a confirmação de sucesso para o Frontend.
7. O Frontend atualiza a interface exibindo o status do pagamento como liquidado.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend2 as Backend 2
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: informa dados do pagamento e confirma
    Frontend->>Backend2: POST /pagamentos (CT8)
    Backend2->>Banco: INSERT/UPDATE pagamento (situacao: pago)
    Banco-->>Backend2: confirmação de gravação
    Backend2-->>Frontend: resposta de sucesso
    Frontend-->>Prestador: exibe status de pagamento atualizado
