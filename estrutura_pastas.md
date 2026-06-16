# Estrutura de Pastas do Repositório Argos Intelligence

Este documento detalha a estrutura de pastas do repositório `gusborba9-star/argos-intelligence`.

```
.
./app
./app/api
./app/api/argos
./app/api/argos/v4
./app/api/argos/v4/debug
./app/api/argos/v4/schedule-ingestion
./app/api/argos/v4/settle
./app/api/argos/v4/tune
./app/dashboard
./components
./components/ui
./docs
./lib
./lib/argos
./lib/argos/analytics
./lib/argos/auditor
./lib/argos/delivery
./lib/argos/ingestion
./lib/argos/notifications
./lib/argos/orchestrator
./lib/argos/regime
./lib/argos/syndicate
./lib/core
./lib/core/contracts
./public
./supabase
./supabase/migrations
./supabase/migrations/migrations
./supabase/migrations/migrations/phase4_4_monetization
```

## Descrição das Pastas Principais

- **`./app`**: Contém os arquivos principais da aplicação, incluindo rotas e layouts.
  - **`./app/api`**: Diretório para as rotas de API da aplicação.
    - **`./app/api/argos`**: APIs específicas do projeto Argos.
      - **`./app/api/argos/v4`**: Versão 4 das APIs do Argos.
        - **`./app/api/argos/v4/debug`**: Endpoints de API para depuração.
        - **`./app/api/argos/v4/schedule-ingestion`**: Endpoints para agendamento de ingestão de dados.
        - **`./app/api/argos/v4/settle`**: Endpoints relacionados a processos de liquidação.
        - **`./app/api/argos/v4/tune`**: Endpoints para ajuste e otimização.
  - **`./app/dashboard`**: Componentes e lógica para o painel de controle da aplicação.
- **`./components`**: Componentes reutilizáveis da interface do usuário.
  - **`./components/ui`**: Componentes de UI genéricos ou de biblioteca.
- **`./docs`**: Documentação do projeto, incluindo guias e arquitetura.
- **`./lib`**: Biblioteca de funções e utilitários do projeto.
  - **`./lib/argos`**: Lógica de negócios e módulos específicos do Argos.
    - **`./lib/argos/analytics`**: Módulos para funcionalidades de análise.
    - **`./lib/argos/auditor`**: Módulos para auditoria.
    - **`./lib/argos/delivery`**: Módulos para entrega de funcionalidades.
    - **`./lib/argos/ingestion`**: Módulos para ingestão de dados.
    - **`./lib/argos/notifications`**: Módulos para notificações.
    - **`./lib/argos/orchestrator`**: Módulos para orquestração de processos.
    - **`./lib/argos/regime`**: Módulos relacionados a regimes ou regras de negócio.
    - **`./lib/argos/syndicate`**: Módulos para sindicação de dados ou conteúdo.
  - **`./lib/core`**: Módulos de funcionalidades centrais ou de baixo nível.
    - **`./lib/core/contracts`**: Definições de contratos ou interfaces.
- **`./public`**: Ativos estáticos acessíveis publicamente (imagens, etc.).
- **`./supabase`**: Configurações e arquivos relacionados ao Supabase.
  - **`./supabase/migrations`**: Migrações do banco de dados Supabase.
    - **`./supabase/migrations/migrations`**: Subdiretório para migrações.
      - **`./supabase/migrations/migrations/phase4_4_monetization`**: Migrações específicas da fase 4.4 de monetização.
