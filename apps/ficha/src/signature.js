/**
 * Canvas de assinatura com Pointer Events.
 * Funciona com dedo, caneta e mouse; preserva o traço ao redimensionar.
 */

export class SignaturePad {
  constructor(canvas, { placeholder = null, onChange = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.placeholder = placeholder;
    this.onChange = onChange;
    this.desenhou = false;
    this.pontos = 0;
    this.desenhando = false;
    this.ultimo = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

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
      } catch {
        // Evento sintético ou ponteiro já liberado: segue sem captura.
      }
      this.desenhando = true;
      const p = this._pos(e);
      this.ultimo = p;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.pontos += 1;
      this._marcarDesenhou();
    };

    const mover = (e) => {
      if (!this.desenhando) return;
      e.preventDefault();
      const p = this._pos(e);
      const meio = {
        x: (this.ultimo.x + p.x) / 2,
        y: (this.ultimo.y + p.y) / 2,
      };
      this.ctx.beginPath();
      this.ctx.moveTo(this.ultimo.x, this.ultimo.y);
      this.ctx.quadraticCurveTo(this.ultimo.x, this.ultimo.y, meio.x, meio.y);
      this.ctx.stroke();
      this.ultimo = p;
      this.pontos += 1;
    };

    const parar = (e) => {
      if (!this.desenhando) return;
      e.preventDefault?.();
      this.desenhando = false;
      this.ultimo = null;
      this.ctx.beginPath();
    };

    this.canvas.addEventListener("pointerdown", iniciar);
    this.canvas.addEventListener("pointermove", mover);
    this.canvas.addEventListener("pointerup", parar);
    this.canvas.addEventListener("pointercancel", parar);
    this.canvas.addEventListener("pointerleave", parar);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _marcarDesenhou() {
    if (this.desenhou) return;
    this.desenhou = true;
    if (this.placeholder) this.placeholder.style.opacity = "0";
    this.onChange?.(true);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const altura = r.height || 180;

    let copia = null;
    if (this.desenhou) {
      copia = document.createElement("canvas");
      copia.width = this.canvas.width;
      copia.height = this.canvas.height;
      copia.getContext("2d").drawImage(this.canvas, 0, 0);
    }

    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(altura * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.strokeStyle = "#1c1c1c";
    this.ctx.fillStyle = "#1c1c1c";
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    if (copia) {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.drawImage(copia, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
  }

  limpar() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.desenhou = false;
    this.pontos = 0;
    this.desenhando = false;
    this.ultimo = null;
    if (this.placeholder) this.placeholder.style.opacity = "1";
    this.onChange?.(false);
  }

  temTraco() {
    return this.desenhou && this.pontos >= 8;
  }

  paraDataURL() {
    return this.temTraco() ? this.canvas.toDataURL("image/png") : null;
  }

  destroyed() {
    this._resizeObserver?.disconnect();
  }
}
