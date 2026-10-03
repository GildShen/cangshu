# EPUB Reader

The Source Han serif/sans choices load the corresponding Google Fonts Noto
Serif TC / Noto Sans TC webfonts (400 and 700, display=swap) in web and EPUB
views. Exported HTML also loads these optional fonts when online. Offline or
on a blocked connection, installed/local fallback fonts are used; book text,
images and reader controls remain self-contained. PMingLiU and Microsoft
JhengHei use installed system fonts and are not downloaded.

Fullscreen buttons are available in the reader toolbar and image viewer.
Escape exits browser fullscreen. Images automatically scale up or down to fit
the viewer, including after rotation. Alt-click an image to rotate clockwise
90 degrees; Ctrl-click rotates counterclockwise 90 degrees. These gestures
work both when opening a chapter image and inside its enlarged viewer. If
both modifiers are pressed, Ctrl takes precedence.

Keyboard reading: Left/Up goes back one screen, Right/Down advances one screen.
Page Up and Page Down select the previous and next chapter. In web mode,
arrows cross to the adjacent chapter when the chapter boundary is reached.
Shortcuts pause while editing a control or viewing an image/note dialog.
Image dialogs include clockwise/counterclockwise 90-degree rotation; images
are fitted again after rotation. Rotation is temporary and does not modify
the original file. Newly exported offline readers include these features.

Open `index.html` in a desktop browser. Choose one or several EPUB files using
the import button, or drag files onto the page. All application dependencies
are included in `vendor`; no server or account is required.

The library stores EPUB bytes, covers, and metadata in IndexedDB. Reading
positions are stored separately using EPUB CFIs. Appearance preferences use
localStorage. Keep the same browser profile and file location for continued
access. Clearing browser site data removes this library; keep original EPUBs.

Features: library search and sorting, duplicate detection by SHA-256, nested
EPUB navigation, per-book reading position, font size and line spacing, light
and dark themes, image enlargement, and zy-footnote annotations. EPUB files
with DRM are not supported. Some fixed-layout books may not respond to font
size changes.

## Web conversion

The import selector defaults to importing and converting into web format.
Choose EPUB-only to postpone conversion. Existing library entries have a
conversion icon; after conversion, it becomes an offline ZIP download icon.
The reading-mode selector switches between scrolling web chapters and the
original EPUB rendition. Each mode keeps its own reading position.

Conversion preserves the spine order, nested EPUB 2/3 navigation, text,
tables, image references, and internal anchor links. It normalizes formatting
and removes embedded scripts and original CSS. Images and notes can be opened
from the web reader. Unsupported assets are reported rather than silently
claiming a complete conversion. The original EPUB remains in the library.

The exported ZIP contains a self-contained index.html with images, reader,
navigation, typography controls, and local reading progress. Extract it and
open index.html. No web server, CDN, or account is needed.

Conversion does not change Simplified Chinese into Traditional Chinese.
Fixed-layout books may lose their original page composition in web mode;
switch to EPUB mode to retain that layout.

Implementation: EPUB.js 0.3.93, JSZip 3.10.1, Lucide 0.468.0. EPUB content runs
in EPUB.js's default non-scripted iframe sandbox.

Validation: run `npm test` in `desktop/` for the published unit tests.
Additional local tests have checked real EPUB/PDF reading, annotations and
layouts at 390, 768, 1440, 1920 and 2560 pixels in Electron. Private book
fixtures, screenshots and the scripts that depend on them are not published.
