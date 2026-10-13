# Fluxo do E8: Criação de Orçamentos

**Feito quando:** O prestador cria um orçamento vinculado a um cliente, informa os valores e consegue consultá-lo posteriormente.

## Passos
1. O prestador acessa a seção de orçamentos no Frontend e clica em "Novo Orçamento", selecionando o cliente e detalhando os itens e valores.
2. O Frontend envia uma requisição HTTP POST para o **Backend 2** (responsável pelo domínio financeiro) com a operação `criarOrcamento` (CT7).
3. O Backend 2 valida os valores informados, calcula o total e executa a persistência gravando o orçamento na tabela correspondente do banco de dados unificado.
4. O Banco de Dados confirma a gravação do registro financeiro.
5. O Backend 2 retorna a resposta HTTP de sucesso contendo os dados do orçamento gerado.
6. O Frontend exibe o orçamento criado na listagem financeira do prestador.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend2 as Backend 2
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: preenche itens e valores do orçamento
    Frontend->>Backend2: POST /orcamentos (CT7)
    Backend2->>Banco: INSERT INTO orcamento (valor_total, cliente_id)
    Banco-->>Backend2: confirmação de gravação
    Backend2-->>Frontend: resposta de sucesso com dados do orçamento
    Frontend-->>Prestador: exibe o orçamento gerado na listagem
