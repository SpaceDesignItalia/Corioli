/** Rapporto blocco firma/timbro ricetta (180×60 px layout → 3:1) */
export const SIGNATURE_STAMP_ASPECT = 3;

/** Risoluzione export ritaglio (4× rispetto al layout PDF) */
export const SIGNATURE_STAMP_EXPORT_WIDTH = 720;
export const SIGNATURE_STAMP_EXPORT_HEIGHT =
  SIGNATURE_STAMP_EXPORT_WIDTH / SIGNATURE_STAMP_ASPECT;

/** Dimensioni display nel PDF ricetta (unità layout prima di RX) */
export const SIGNATURE_STAMP_PDF_LAYOUT_W = 180;
export const SIGNATURE_STAMP_PDF_LAYOUT_H = 60;

const ASPECT_TOLERANCE = 0.02;

function isAlreadyCroppedExport(
  width: number,
  height: number,
  dataUrl: string,
): boolean {
  return (
    width === SIGNATURE_STAMP_EXPORT_WIDTH &&
    height === SIGNATURE_STAMP_EXPORT_HEIGHT &&
    Math.abs(width / height - SIGNATURE_STAMP_ASPECT) < ASPECT_TOLERANCE &&
    dataUrl.startsWith("data:image/png")
  );
}

/**
 * Normalizza timbro/firma al rapporto 3:1 (ritaglio centrale se necessario).
 * Immagini già esportate dal crop in Settings vengono riusate così come sono.
 */
export function normalizeSignatureStampImage(
  imageSrc: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) {
        reject(new Error("Immagine non valida"));
        return;
      }

      if (isAlreadyCroppedExport(nw, nh, imageSrc)) {
        resolve(imageSrc);
        return;
      }

      const currentAspect = nw / nh;
      let sx: number;
      let sy: number;
      let sw: number;
      let sh: number;

      if (currentAspect > SIGNATURE_STAMP_ASPECT) {
        sh = nh;
        sw = nh * SIGNATURE_STAMP_ASPECT;
        sx = (nw - sw) / 2;
        sy = 0;
      } else {
        sw = nw;
        sh = nw / SIGNATURE_STAMP_ASPECT;
        sx = 0;
        sy = (nh - sh) / 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = SIGNATURE_STAMP_EXPORT_WIDTH;
      canvas.height = SIGNATURE_STAMP_EXPORT_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas non disponibile"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, SIGNATURE_STAMP_EXPORT_WIDTH, SIGNATURE_STAMP_EXPORT_HEIGHT);
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        SIGNATURE_STAMP_EXPORT_WIDTH,
        SIGNATURE_STAMP_EXPORT_HEIGHT,
      );
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Caricamento immagine fallito"));
    img.src = imageSrc;
  });
}

export function signatureStampPdfFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}
