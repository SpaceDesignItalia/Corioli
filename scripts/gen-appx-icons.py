"""
Genera icone Windows (.ico) e asset AppX/Store richiesti
a partire da public/corioli-icon.png.

Asset richiesti da electron-builder / Microsoft Store:
  - StoreLogo.png              50x50
  - Square44x44Logo.png        44x44
  - Square150x150Logo.png      150x150
  - Wide310x150Logo.png        310x150

Nota: non generiamo varianti .scale-* / .targetsize-* perché
electron-builder le indicizza con makepri.exe, che spesso fallisce
(PRI191 0x8007007e) su build locali. I PNG base sono sufficienti.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "corioli-icon.png"
APPX_DIR = ROOT / "build" / "appx"
ICON_ICO = ROOT / "build" / "icon.ico"
BG = (0, 0, 0, 255)


def fit_square(img: Image.Image, size: int, bg: tuple = BG) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    scale = min(size / img.width, size / img.height) * 0.92
    w, h = int(img.width * scale), int(img.height * scale)
    resized = img.resize((w, h), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - w) // 2, (size - h) // 2), resized)
    return canvas


def fit_wide(img: Image.Image, width: int, height: int, bg: tuple = BG) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), bg)
    scale = min(width / img.width, height / img.height) * 0.92
    w, h = int(img.width * scale), int(img.height * scale)
    resized = img.resize((w, h), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((width - w) // 2, (height - h) // 2), resized)
    return canvas


def save_rgb(img: Image.Image, path: Path) -> None:
    img.convert("RGB").save(path, "PNG")
    print(f"  {path.name}  ({img.width}x{img.height})")


def main() -> None:
    APPX_DIR.mkdir(parents=True, exist_ok=True)
    ICON_ICO.parent.mkdir(parents=True, exist_ok=True)

    # Rimuovi varianti scale/targetsize che rompono makepri.exe
    for old in APPX_DIR.iterdir():
        if ".scale-" in old.name or ".targetsize-" in old.name:
            old.unlink()
            print(f"  rimosso {old.name}")

    img = Image.open(SRC).convert("RGBA")
    print(f"Sorgente: {SRC}  ({img.width}x{img.height})")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_frames = [fit_square(img, s).convert("RGBA") for s in ico_sizes]
    ico_frames[-1].save(
        ICON_ICO,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_frames[:-1],
    )
    print(f"\nIcona .ico: {ICON_ICO}")

    print("\nAsset AppX:")
    save_rgb(fit_square(img, 50), APPX_DIR / "StoreLogo.png")
    save_rgb(fit_square(img, 44), APPX_DIR / "Square44x44Logo.png")
    save_rgb(fit_square(img, 150), APPX_DIR / "Square150x150Logo.png")
    save_rgb(fit_wide(img, 310, 150), APPX_DIR / "Wide310x150Logo.png")
    save_rgb(fit_square(img, 310), APPX_DIR / "LargeTile.png")
    save_rgb(fit_square(img, 71), APPX_DIR / "SmallTile.png")

    print(f"\nTotale file in {APPX_DIR}: {len(list(APPX_DIR.iterdir()))}")
    print("Fatto.")


if __name__ == "__main__":
    main()
