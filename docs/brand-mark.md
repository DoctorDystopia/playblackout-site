# The brand mark

The jackal sigil, and why the files in `public/brand/` look the way they do.

## What ships

| File | Size | Drawn at | Used by |
|---|---|---|---|
| `public/brand/blackout-mark-96.png` | 96px | 32px | `Nav.astro`, every page |
| `public/brand/blackout-mark-640.png` | 640px | 160–240px | `index.astro`, the hero |
| `public/og-default.png` | 1200×630 | — | `Base.astro`, social cards |
| `docs/brand/blackout-mark-master.png` | 1024px | — | nothing; the source for the three above |

Paths are declared once, in `src/config.ts` → `BRAND_MARK`. A component that
needs the mark imports that rather than typing a path.

**Two sizes, not one.** The nav mark is on every page and the hero mark is
seventeen times its byte count. Serving the large one into a 32px box would put
170 KB on every navigation to save a single file.

## The transparent field, and why it took a flood fill

The original art is 5500×5500 on a **pure black field**, and the mark's own
interior is black too — the upper-left half inside the diamond, the outlines
everywhere. So "make black transparent" punches holes straight through the
artwork.

What the recipe below removes instead is only the black **connected to the image
border**. The diamond's border is an unbroken ring of `(126, 0, 1)`, so a fill
starting outside it cannot leak in, and every interior black survives exactly as
drawn. On the source art that is one connected region out of 355.

Separation is on the **max channel**, not luma. The diamond's border red is
`(126, 0, 1)`: luma 38, max channel 126. The field is under 8 either way. Max
channel puts 118 between them where luma puts 30, which is the difference
between a threshold that is obviously right and one that is a judgement call
about JPEG ringing.

**Why bother, when the site's ground is already near-black?** Because
`--color-void` is `#07080b` and not `#000`, so a black-matted mark on a card
(`--color-surface`, `#0e1016`) shows a visible square. The mark is now clean on
both.

## Regenerating, or adding a size

`docs/brand/blackout-mark-master.png` is the 1024px trimmed, transparent master.
The expensive and fiddly step — field removal — is already baked into it, so a
new size is only a resize:

```python
# pip install pillow numpy
import numpy as np
from PIL import Image

master = Image.open("docs/brand/blackout-mark-master.png")


def down(img, side):
    """Downscale on PREMULTIPLIED colour.

    Lanczos averages RGB and alpha independently, so a transparent black pixel
    drags its neighbours down and leaves a dark fringe -- invisible on this
    site's ground, obvious the moment the mark lands on a lighter card.
    Premultiplying weights colour by coverage, which is what an edge pixel
    means.
    """
    a = np.asarray(img).astype(np.float64)
    cov = a[:, :, 3:4] / 255.0
    pre = np.dstack([a[:, :, :3] * cov, a[:, :, 3]]).astype(np.uint8)
    s = np.asarray(Image.fromarray(pre).resize((side, side), Image.LANCZOS)).astype(np.float64)
    c2 = np.maximum(s[:, :, 3:4] / 255.0, 1e-6)
    return Image.fromarray(
        np.dstack([np.clip(s[:, :, :3] / c2, 0, 255), s[:, :, 3]]).astype(np.uint8)
    )


down(master, 128).save("public/brand/blackout-mark-128.png", optimize=True)
```

Rebuilding the master from the original JPEG needs `scipy` as well, for
`ndimage.label`; the fill is the only part of the pipeline that needs it.

## What the mark will not do

**It is illegible below about 32px.** The full lockup is a diamond, a wordmark
and a cabled head; at 24px they average into a grey smear. 32px in the nav is
the floor, and it reads there as a shape rather than as a picture — which is all
a nav lockup has to do.

If a genuinely small mark is ever needed (a favicon, an app icon, a Discord
avatar), crop to the **head alone** rather than shrinking the lockup. The head
with its red eye survives 24px; the diamond around it does not.

`public/favicon.svg` is therefore still the original abstract mark, not this
one. Swapping it is a real decision, not a copy.

## The Open Graph card

`og-default.png` is the mark centred on `--color-void` with a glow in the
diamond's own red. It carries **no type**, because the brand face is Chakra
Petch and the card is generated outside the browser where that font is not
available — a near-miss font on a share card is worse than no words at all.

It was also, until this file existed, a **404**: `Base.astro` has always pointed
`og:image` at `/og-default.png` and nothing was ever there.
