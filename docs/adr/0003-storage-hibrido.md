# ADR 0003 — Storage híbrido: Drive do cliente por padrão, R2 no plano pago

**Data:** 2026-11-05  
**Status:** aceito

## Contexto

O cliente já usa Google Drive e quer “posse” dos documentos. Guardar tudo em nosso storage aumenta custo, responsabilidade e superfície LGPD. Ao mesmo tempo, depender só do Drive cria atrito quando o cliente não quer conectar OAuth.

## Decisão

- Interface única `StorageAdapter` com `upload`, `download`, `delete`.
- Padrão: Google Drive via OAuth `drive.file`, pasta `FichaPro - {negócio}` → `AAAA-MM`.
- Plano pago/fallback: Cloudflare R2, chave `${tenantId}/${fichaId}/${arquivo}`.
- Tokens do Drive ficam em `tenant_secrets`, criptografados, sem acesso de `authenticated`.
- O tenant pode desconectar o Drive e voltar para R2.

## Consequências

- Custo marginal próximo de zero no plano básico.
- O cliente mantém os arquivos no próprio Drive.
- `drive.file` limita o app aos arquivos que ele criou — bom para privacidade, mas impede varrer pastas antigas.
- Falha/expiração do token vira erro de job; o tenant precisa reconectar.
- PDFs no Drive não são apagados pelo expurgo do banco; a limpeza é responsabilidade do cliente ou de rotina futura.

## Alternativas descartadas

- **Só R2:** custo baixo, mas exige plano pago desde o início e não dá “posse no Drive”.
- **Só Drive:** simples, mas sem fallback e com dependência total do OAuth.
- **S3:** mais caro e sem vantagem sobre R2 para egress zero.
