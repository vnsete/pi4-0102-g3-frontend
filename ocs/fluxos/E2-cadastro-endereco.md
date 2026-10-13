# Fluxo do E2: Cadastro de Endereço

**Feito quando:** O prestador registra um endereço vinculado a um cliente e consegue consultá-lo posteriormente em seu cadastro.

## Passos
1. O prestador seleciona um cliente já cadastrado na interface do Frontend.
2. O prestador clica em "Adicionar Endereço" e preenche os campos (CEP, logradouro, número, bairro, cidade e estado).
3. O Frontend envia uma requisição HTTP POST para o Backend 1 usando a operação `cadastrarEndereco` (CT2).
4. O Backend 1 valida se o ID do cliente informado existe e se os dados do endereço estão corretos.
5. O Backend 1 grava as informações na tabela de endereços do banco de dados (vinculada ao ID do cliente).
6. O Banco de Dados confirma a persistência do endereço.
7. O Backend 1 retorna a resposta de sucesso com os dados do endereço cadastrado.
8. O Frontend atualiza a tela do cliente exibindo o endereço recém-adicionado.

## Diagrama de Sequência
```mermaid
sequenceDiagram
    actor Prestador as Prestador
    participant Frontend as Frontend
    participant Backend1 as Backend 1
    participant Banco as Banco de Dados
    
    Prestador->>Frontend: preenche dados do endereço e clica em salvar
    Frontend->>Backend1: POST /clientes/{id}/enderecos (CT2)
    Backend1->>Banco: INSERT INTO endereco (relacionado ao cliente)
    Banco-->>Backend1: confirmação de gravação
    Backend1-->>Frontend: resposta de sucesso com dados do endereço
    Frontend-->>Prestador: exibe endereço vinculado no perfil do cliente
