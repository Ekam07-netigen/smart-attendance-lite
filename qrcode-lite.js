/*
  QRCode Lite (VERY small demo helper)
  Purpose: draw a scannable-ish code WITHOUT external libs for hackathon demos.
  Note: This is not a full QR implementation; it encodes data as a simple
  "visual hash" pattern. For real QR, swap with a proper library later.
*/

(function () {
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function drawVisualHash(canvas, text) {
    const ctx = canvas.getContext("2d");
    const size = Math.min(canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    // 21x21 like a small QR.
    const n = 21;
    const cell = Math.floor(size / n);
    const pad = Math.floor((size - cell * n) / 2);

    // finder-like corners (just for looks)
    function finder(x, y) {
      ctx.fillStyle = "#000";
      ctx.fillRect(pad + x * cell, pad + y * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = "#fff";
      ctx.fillRect(pad + (x + 1) * cell, pad + (y + 1) * cell, 5 * cell, 5 * cell);
      ctx.fillStyle = "#000";
      ctx.fillRect(pad + (x + 2) * cell, pad + (y + 2) * cell, 3 * cell, 3 * cell);
    }
    finder(0, 0);
    finder(n - 7, 0);
    finder(0, n - 7);

    const seed = hashString(text || "");
    let x = seed;

    // fill remaining cells pseudo-randomly
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const inFinder =
          (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
        if (inFinder) continue;

        // xorshift
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        const bit = x & 1;
        if (bit) {
          ctx.fillStyle = "#000";
          ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
        }
      }
    }

    ctx.fillStyle = "#111";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(text ? String(text).slice(0, 18) : "—", size / 2, size - 6);
  }

  window.QRCodeLite = { drawVisualHash };
})();

