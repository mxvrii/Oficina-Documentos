// ---------- Tema (Light / Dark) ----------
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}
applyTheme(localStorage.getItem('theme') || 'light');
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'private') refreshPrivateStatus();
  });
});

// ---------- Utilidades ----------
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d) {
  return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function renderFileList(container, files, { downloadUrl, deleteUrl, onDelete }) {
  container.innerHTML = '';
  if (files.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No hay archivos todavía.</p>';
    return;
  }
  files.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-info">
        <span class="file-name">${f.name}</span>
        <span class="file-meta">${formatSize(f.size)} · ${formatDate(f.date)}</span>
      </div>
      <div class="file-actions">
        <a class="icon-btn" href="${downloadUrl(f.name)}">Descargar</a>
        <button class="icon-btn danger" data-name="${f.name}">Eliminar</button>
      </div>
    `;
    item.querySelector('.danger').addEventListener('click', () => onDelete(f.name));
    container.appendChild(item);
  });
}

async function uploadFiles(url, files) {
  const formData = new FormData();
  [...files].forEach((f) => formData.append('files', f));
  const res = await fetch(url, { method: 'POST', body: formData });
  return res.json();
}

function setupDropzone(dropzoneEl, inputEl, onFiles) {
  dropzoneEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => onFiles(inputEl.files));
  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropzoneEl.addEventListener(evt, (e) => e.preventDefault());
  });
  dropzoneEl.addEventListener('dragover', () => dropzoneEl.classList.add('dragover'));
  dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('dragover'));
  dropzoneEl.addEventListener('drop', (e) => {
    dropzoneEl.classList.remove('dragover');
    onFiles(e.dataTransfer.files);
  });
}

// ---------- SECCIÓN COMPARTIDA ----------
async function refreshSharedList() {
  const res = await fetch('/api/shared/list');
  const files = await res.json();
  renderFileList(document.getElementById('shared-list'), files, {
    downloadUrl: (name) => `/api/shared/download/${encodeURIComponent(name)}`,
    onDelete: async (name) => {
      await fetch(`/api/shared/${encodeURIComponent(name)}`, { method: 'DELETE' });
      toast('Archivo eliminado');
      refreshSharedList();
    },
  });
}

setupDropzone(
  document.getElementById('shared-dropzone'),
  document.getElementById('shared-input'),
  async (files) => {
    if (!files.length) return;
    await uploadFiles('/api/shared/upload', files);
    toast('Archivo(s) subido(s) a Compartido');
    refreshSharedList();
  }
);

// ---------- SECCIÓN PRIVADA ----------
async function refreshPrivateStatus() {
  const res = await fetch('/api/private/status');
  const status = await res.json();

  const lockedBox = document.getElementById('private-locked');
  const unlockedBox = document.getElementById('private-unlocked');
  const setupCard = document.getElementById('private-setup');
  const loginCard = document.getElementById('private-login');

  if (status.unlocked) {
    lockedBox.classList.add('hidden');
    unlockedBox.classList.remove('hidden');
    refreshPrivateList();
  } else {
    unlockedBox.classList.add('hidden');
    lockedBox.classList.remove('hidden');
    if (status.passwordSet) {
      setupCard.hidden = true;
      loginCard.hidden = false;
    } else {
      setupCard.hidden = false;
      loginCard.hidden = true;
    }
  }
}

async function refreshPrivateList() {
  const res = await fetch('/api/private/list');
  if (res.status === 401) return refreshPrivateStatus();
  const files = await res.json();
  renderFileList(document.getElementById('private-list'), files, {
    downloadUrl: (name) => `/api/private/download/${encodeURIComponent(name)}`,
    onDelete: async (name) => {
      await fetch(`/api/private/${encodeURIComponent(name)}`, { method: 'DELETE' });
      toast('Archivo eliminado');
      refreshPrivateList();
    },
  });
}

document.getElementById('setup-btn').addEventListener('click', async () => {
  const password = document.getElementById('setup-password').value;
  const res = await fetch('/api/private/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  const errEl = document.getElementById('setup-error');
  if (!res.ok) {
    errEl.textContent = data.error;
    return;
  }
  errEl.textContent = '';
  toast('Contraseña creada. Carpeta privada desbloqueada.');
  refreshPrivateStatus();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const password = document.getElementById('login-password').value;
  const res = await fetch('/api/private/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  const errEl = document.getElementById('login-error');
  if (!res.ok) {
    errEl.textContent = data.error;
    return;
  }
  errEl.textContent = '';
  document.getElementById('login-password').value = '';
  refreshPrivateStatus();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/private/logout', { method: 'POST' });
  toast('Sesión privada cerrada');
  refreshPrivateStatus();
});

document.getElementById('change-pass-btn').addEventListener('click', async () => {
  const newPassword = prompt('Ingresá la nueva contraseña:');
  if (!newPassword) return;
  const res = await fetch('/api/private/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    toast(data.error);
    return;
  }
  toast('Contraseña actualizada');
});

setupDropzone(
  document.getElementById('private-dropzone'),
  document.getElementById('private-input'),
  async (files) => {
    if (!files.length) return;
    await uploadFiles('/api/private/upload', files);
    toast('Archivo(s) subido(s) a la carpeta privada');
    refreshPrivateList();
  }
);

// ---------- Inicio ----------
refreshSharedList();

// 1. Conectarse a la red P2P global de PeerJS (sin indicar host/port local)
const peer = new Peer(); 

// ID de tu PC Base (debe coincidir con el ID configurado en tu servidor de archivos)
const PC_BASE_ID = 'mi-pc-servidor-base-2026';

peer.on('open', (myId) => {
  console.log('Cliente P2P listo. Tu ID público es:', myId);
  
  // 2. Establecer la llamada/conexión P2P directa hacia la PC Base
  const conn = peer.connect(PC_BASE_ID);

  conn.on('open', () => {
    console.log('Conexión P2P establecida con la PC Base!');
    // Solicitar lista de archivos al conectar
    conn.send({ action: 'GET_FILE_LIST' });
  });

  conn.on('data', (data) => {
    if (data.type === 'FILE_LIST') {
      console.log('Archivos recibidos de la PC Base:', data.files);
      // Aquí renderizas los archivos en tu HTML
    }
  });

  conn.on('error', (err) => {
    console.error('Error en la conexión P2P:', err);
  });
});