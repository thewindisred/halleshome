Add media here and list them in manifest.json so the gallery can load them.

1) Place files in this folder (images: jpg/png/webp; videos: mp4/webm).
2) Edit manifest.json and add an entry per file:
   { "type": "image", "src": "your-file.jpg", "title": "Optional title", "alt": "Short description" }
   or
   { "type": "video", "src": "your-video.mp4", "title": "Optional title" }
3) Open gallery.html to view.

Tip: Videos try to autoplay with sound; if blocked by the browser, they fall back to muted. Use the Unmute button in the viewer.

Note: If you open gallery.html directly from the file system, the browser may block fetch(). Use a simple local server (e.g., VS Code Live Server, or `python -m http.server`) and open via http://localhost to avoid CORS/file URL restrictions.
