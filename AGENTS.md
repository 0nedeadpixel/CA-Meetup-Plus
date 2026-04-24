# System Instructions

## File Modification Rules
- **CRITICAL**: Do NOT mark any files in the `/public/` directory for deletion, especially the `/public/img/` directory which contains branding assets (`meetupplus-icon.png`, `meetupplus.png`) and PWA GIFs (`happy-pika.gif`, etc.). These are binary files managed via GitHub.
- Only suggest or make changes to the text-based source code in the root or `/components/`, `/src/`, etc. folders.
- **Image Paths**: Images are stored in the Vite `public` folder (e.g., `/public/img/`). When referencing these images in code (HTML, TSX, JS), ALWAYS use the relative path starting from the root without the 'public' prefix: `/img/filename.ext` (e.g., `<img src="/img/meetupplus.png" />`).
