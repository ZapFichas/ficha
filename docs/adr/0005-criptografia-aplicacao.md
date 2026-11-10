# ADR 0005 — Criptografia de dados sensíveis na aplicação

**Data:** 2026-11-05  
**Status:** aceito

## Contexto

Fichas contêm dados de saúde, CPF, documento e assinatura — categoria sensível na LGPD. O Supabase criptografa o disco, mas queremos que um dump/backup ou acesso indevido ao banco não exponha o conteúdo diretamente.

## Decisão

- O payload completo (respostas do formulário, uploads como metadados, meta) é serializado em JSON e cifrado com **AES-256-GCM** no Worker.
- Formato do envelope: `v1.<iv_base64>.<ciphertext_base64>`.
- Chave `DATA_ENCRYPTION_KEY` (32 bytes base64) em secret do Worker; nunca no banco.
- `fichas.dados_json` guarda apenas resumo não sensível para listagem/métricas.
- `fichas.dados_cifrados` guarda o payload cifrado.
- CPF: HMAC-SHA256 com pepper para busca/dedupe + últimos 4 dígitos para exibição.
- PDF é gerado após decrypt no Worker; o hash do conteúdo assinado é gravado em `assinaturas`.

## Consequências

- Banco comprometido sem a chave não revela dados de saúde.
- Painel precisa passar pelo Worker para descriptografar; não consulta `dados_cifrados` direto.
- Perda da chave = perda dos dados. Backup da chave em cofre é obrigatório.
- Rotação de chave exige re-encrypt (envelope versionado permite migração).
- `cliente_nome` fica em claro por necessidade de busca; é um dado pessoal, mas não sensível na mesma escala.

## Alternativas descartadas

- **Só criptografia de disco do Supabase:** não protege contra dump/backup vazado.
- **pgcrypto com chave no banco:** a chave ficaria junto do dado; pouco ganho.
- **Criptografia no browser:** dificulta validação server-side e rotação; o Worker ainda veria o dado.
- **Guardar CPF em claro “para busca”:** risco desnecessário; HMAC resolve.
