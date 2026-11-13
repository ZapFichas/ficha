/**
 * Canvas de assinatura com Pointer Events.
 *
 * Qualidade:
 * - traço contínuo com curvas quadráticas entre pontos médios (sem "pontilhado");
 * - render em alta densidade (até 3x, conforme a tela);
 * - export corta o espaço vazio e gera PNG em fundo branco, com boa resolução
 *   para o PDF e para o comprovante.
 */

const COR_TRACO = "#101a16";
const LARGURA_TRACO = 2.6;
const PADDING_EXPORT = 14;

export class SignaturePad {
  constructor(canvas, { placeholder = null, onChange = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.placeholder = placeholder;
    this.onChange = onChange;
    this.desenhou = false;
    this.pontos = 0;
    this.desenhando = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.tracos = [];
    this.tracoAtual = null;
    this.larguraBase = 0;
    this.alturaBase = 0;

    this._bind();
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(canvas);
    this.resize();
  }

  _bind() {
    const iniciar = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try {
        this.canvas.setPointerCapture?.(e.pointerId);
        this.capturou = true;
      } catch {
        this.capturou = false;
      }
      this.desenhando = true;
      const p = this._pos(e);
      this.tracoAtual = { pontos: [p] };
      this.tracos.push(this.tracoAtual);
      this.ultimoMeio = p;
      this._ponto(p);
      this.pontos += 1;
      this._marcarDesenhou();
    };

    const mover = (e) => {
      if (!this.desenhando || !this.tracoAtual) return;
      e.preventDefault();
      const eventos =
        typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
      for (const evento of eventos.length ? eventos : [e]) {
        const p = this._pos(evento);
        const anterior = this.tracoAtual.pontos[this.tracoAtual.pontos.length - 1];
        if (!anterior) continue;
        const distancia = Math.hypot(p.x - anterior.x, p.y - anterior.y);
        if (distancia < 0.35) continue;
        this.tracoAtual.pontos.push(p);
        this._segmento(anterior, p);
        this.pontos += 1;
        this.desenhou = true;
      }
    };

    const parar = (e) => {
      if (!this.desenhando) return;
      e.preventDefault?.();
      this.desenhando = false;
      this._finalizarTraco();
      this.tracoAtual = null;
      this.capturou = false;
      this.ctx.beginPath();
      this.onChange?.(true);
    };

    this.canvas.addEventListener("pointerdown", iniciar);
    this.canvas.addEventListener("pointermove", mover);
    this.canvas.addEventListener("pointerup", parar);
    this.canvas.addEventListener("pointercancel", parar);
    this.canvas.addEventListener("pointerleave", (e) => {
      if (!this.capturou) parar(e);
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _ponto(p) {
    // Ponto inicial: círculo preenchido para não deixar falha no começo do traço.
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, LARGURA_TRACO / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
  }

  /**
   * Curva incremental: sai do último ponto médio para o novo ponto médio,
   * usando o ponto atual como controle. Os segmentos se encontram nos pontos
   * médios, portanto o traço fica contínuo e suave (sem pontilhado).
   */
  _segmento(anterior, atual) {
    const meio = {
      x: (anterior.x + atual.x) / 2,
      y: (anterior.y + atual.y) / 2,
    };
    const inicio = this.ultimoMeio ?? anterior;
    this.ctx.beginPath();
    this.ctx.moveTo(inicio.x, inicio.y);
    this.ctx.quadraticCurveTo(anterior.x, anterior.y, meio.x, meio.y);
    this.ctx.stroke();
    this.ultimoMeio = meio;
    this.ultimoPonto = atual;
  }

  _finalizarTraco() {
    if (this.ultimoMeio && this.ultimoPonto) {
      const d = Math.hypot(
        this.ultimoPonto.x - this.ultimoMeio.x,
        this.ultimoPonto.y - this.ultimoMeio.y
      );
      if (d > 0.5) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.ultimoMeio.x, this.ultimoMeio.y);
        this.ctx.lineTo(this.ultimoPonto.x, this.ultimoPonto.y);
        this.ctx.stroke();
      }
    }
    this.ultimoMeio = null;
    this.ultimoPonto = null;
  }

  _marcarDesenhou() {
    if (!this.desenhou) {
      this.desenhou = true;
      if (this.placeholder) this.placeholder.style.opacity = "0";
    }
  }

  _configurarContexto(ctx, escala = 1) {
    ctx.strokeStyle = COR_TRACO;
    ctx.fillStyle = COR_TRACO;
    ctx.lineWidth = LARGURA_TRACO * escala;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  _desenharTraco(ctx, traco, escalaX = 1, escalaY = 1, offsetX = 0, offsetY = 0) {
    const pontos = traco.pontos.map((p) => ({
      x: p.x * escalaX + offsetX,
      y: p.y * escalaY + offsetY,
    }));
    if (!pontos.length) return;

    if (pontos.length === 1) {
      const p = pontos[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, (LARGURA_TRACO / 2) * escalaX, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pontos[0].x, pontos[0].y);
    for (let i = 1; i < pontos.length - 1; i++) {
      const meio = {
        x: (pontos[i].x + pontos[i + 1].x) / 2,
        y: (pontos[i].y + pontos[i + 1].y) / 2,
      };
      ctx.quadraticCurveTo(pontos[i].x, pontos[i].y, meio.x, meio.y);
    }
    const ultimo = pontos[pontos.length - 1];
    ctx.lineTo(ultimo.x, ultimo.y);
    ctx.stroke();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const altura = r.height || 190;
    const larguraAnterior = this.larguraBase || r.width;
    const alturaAnterior = this.alturaBase || altura;

    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(altura * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._configurarContexto(this.ctx);
    this.ctx.clearRect(0, 0, r.width, altura);

    // Redesenha vetorialmente, sem esticar a imagem antiga.
    const escalaX = r.width / larguraAnterior;
    const escalaY = altura / alturaAnterior;
    for (const traco of this.tracos) {
      this._desenharTraco(this.ctx, traco, escalaX, escalaY);
    }
    if (this.desenhou) {
      this.placeholder && (this.placeholder.style.opacity = "0");
    }
    this.larguraBase = r.width;
    this.alturaBase = altura;
  }

  limpar() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this._configurarContexto(this.ctx);
    this.tracos = [];
    this.tracoAtual = null;
    this.desenhou = false;
    this.pontos = 0;
    this.desenhando = false;
    this.ultimoMeio = null;
    if (this.placeholder) this.placeholder.style.opacity = "1";
    this.onChange?.(false);
  }

  temTraco() {
    return this.desenhou && this.pontos >= 5;
  }

  /**
   * Exporta apenas a área com tinta, em fundo branco e alta resolução.
   * A imagem fica nítida no PDF, no comprovante e no painel.
   */
  paraDataURL() {
    if (!this.temTraco()) return null;

    const pontos = this.tracos.flatMap((t) => t.pontos);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pontos) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) return null;

    const larguraCss = Math.max(24, maxX - minX + PADDING_EXPORT * 2);
    const alturaCss = Math.max(18, maxY - minY + PADDING_EXPORT * 2);
    const escala = Math.max(
      1,
      Math.min(this.dpr, 1600 / larguraCss, 600 / alturaCss)
    );

    const saida = document.createElement("canvas");
    saida.width = Math.max(1, Math.round(larguraCss * escala));
    saida.height = Math.max(1, Math.round(alturaCss * escala));
    const ctx = saida.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, saida.width, saida.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._configurarContexto(ctx, escala);
    for (const traco of this.tracos) {
      this._desenharTraco(
        ctx,
        traco,
        escala,
        escala,
        (-minX + PADDING_EXPORT) * escala,
        (-minY + PADDING_EXPORT) * escala
      );
    }
    return saida.toDataURL("image/png");
  }

  destroyed() {
    this._resizeObserver?.disconnect();
  }
}
