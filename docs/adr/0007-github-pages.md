# ADR 0007 — Frontends no GitHub Pages, API no Cloudflare Workers

**Data:** 2026-11-13  
**Status:** aceito para staging

## Contexto

O PRD previa Cloudflare Pages para a ficha e o painel. O repositório do cliente está no GitHub (`ZapFichas/ficha`), o GitHub Pages já estava habilitado e as URLs fornecidas apontavam para `https://zapfichas.github.io/ficha/...`. O Worker/Queues continuam na Cloudflare.

## Decisão

- Ficha, painel e landings são estáticos no **GitHub Pages**.
- O build gera:
  - `/ficha/<nicho>/` — landing;
  - `/ficha/<nicho>/write/?t=<slug>` — ficha;
  - `/ficha/dashboard/` — painel.
- `FICHA_URL_TEMPLATE` no Worker monta o link do QR por nicho e slug.
- O app da ficha lê `t` (ou `slug`/`tenant`) da query string.
- O painel usa hash routing e `base: "./"` no Vite.
- Deploy via GitHub Actions (`pages.yml`), com Pages Source = **GitHub Actions**.
- A API continua no Cloudflare Worker, com R2/Drive para storage.

## Consequências

- Custo zero de hospedagem estática e deploy integrado ao repositório.
- Sem roteamento server-side: o slug precisa viajar na query string.
- O build precisa das variáveis `VITE_*`; o anon key do Supabase é público e pode ficar no workflow.
- Cloudflare Pages continua possível: basta trocar `FICHA_URL`/`PANEL_URL` e publicar os `dist`.
- O `404.html` redireciona para `/ficha/`; links diretos com slug usam query, então não dependem de fallback de SPA.
