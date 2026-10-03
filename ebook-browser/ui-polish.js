'use strict';
(() => {
  window.WebBookReader?.loadWebFonts();
  const library = document.getElementById('library');
  const sidebar = document.querySelector('.folder-sidebar');
  const heading = document.querySelector('.library-head h1');
  if (sidebar && heading) {
    sidebar.id = 'library-folders';
    const toggle = document.createElement('button');
    toggle.id = 'folders-toggle';
    toggle.type = 'button';
    toggle.title = '開關資料夾';
    toggle.setAttribute('aria-label', '開關資料夾');
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<i data-lucide="panel-left"></i>';
    heading.prepend(toggle);
    const close = (restoreFocus = false) => {
      library.classList.remove('folders-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) toggle.focus();
    };
    toggle.addEventListener('click', () => {
      const opened = library.classList.toggle('folders-open');
      toggle.setAttribute('aria-expanded', String(opened));
      if (opened) sidebar.querySelector('button')?.focus();
    });
    sidebar.addEventListener('click', event => {
      if (event.target.closest('[data-folder]')) close(true);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && library.classList.contains('folders-open')) close(true);
    });
    document.addEventListener('pointerdown', event => {
      if (!sidebar.contains(event.target) && !toggle.contains(event.target)) close();
    });
    matchMedia('(max-width:700px)').addEventListener('change', () => close());
  }
  const importer = document.querySelector('label.command');
  if (importer) {
    importer.tabIndex = 0;
    importer.setAttribute('role', 'button');
    importer.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        document.getElementById('files').click();
      }
    });
  }
  icons();
})();
