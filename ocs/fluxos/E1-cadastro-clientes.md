# Fluxo do E1: Cadastro de Clientes

**Feito quando:** O prestador cadastra um cliente com seus dados básicos e ele passa a aparecer na lista de clientes cadastrados.

## Passos
1. O prestador acessa o painel de gestão no Frontend e clica na seção de clientes.
2. O prestador clica no botão "Novo Cliente" e preenche os dados básicos (nome, telefone e e-mail).
3. O Frontend envia uma requisição HTTP POST para o Backend 1 utilizando a operação `cadastrarCliente` (CT1).
4. O Backend 1 valida se os campos obrigatórios foram preenchidos corretamente e se o telefone já não está cadastrado.
5. O Backend 1 executa a persistência dos dados inserindo o registro na tabela de clientes do banco de dados (CT2).
6. O Banco de Dados confirma a gravação com sucesso para o Backend 1.
7. O Backend 1 retorna a resposta HTTP de sucesso contendo os dados do cliente cadastrado (incluindo o ID gerado).
8. O Frontend atualiza a interface exibindo o novo cliente na listagem oficial.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend1 as Backend 1
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: preenche dados do cliente e clica em salvar
    Frontend->>Backend1: POST /clientes (CT1)
    Backend1->>Banco: INSERT INTO cliente (CT2)
    Banco-->>Backend1: confirmação de gravação
    Backend1-->>Frontend: resposta de sucesso com dados do cliente
    Frontend-->>Prestador: exibe cliente atualizado na listagem
