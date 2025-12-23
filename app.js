// ====== PyLabs app.js ======

const DB_NAME = 'pylabs-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let db;
let currentProject = null;
let currentFile = null;
let filesData = {}; // filename => content
let projectsList = [];

const projectsListEl = document.getElementById('projects-list');
const filesListEl = document.getElementById('files-list');
const editorEl = document.getElementById('editor');
const editorFilenameEl = document.getElementById('editor-filename');
const saveFileBtn = document.getElementById('save-file-btn');
const newProjectBtn = document.getElementById('new-project-btn');
const deleteProjectBtn = document.getElementById('delete-project-btn');
const newFileBtn = document.getElementById('new-file-btn');
const newLibBtn = document.getElementById('new-lib-btn');
const deleteFileBtn = document.getElementById('delete-file-btn');
const exportProjectBtn = document.getElementById('export-project-btn');

// ---------------- IndexedDB ----------------

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject('Failed to open DB');
    request.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    request.onsuccess = e => {
      db = e.target.result;
      resolve();
    };
  });
}

function saveProject(name, files) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ name, files });
    req.onsuccess = () => resolve();
    req.onerror = () => reject('Failed to save project');
  });
}

function loadProject(name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject('Failed to load project');
  });
}

function deleteProject(name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject('Failed to delete project');
  });
}

function listProjects() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject('Failed to list projects');
  });
}

function isValidName(name) {
  return !name.startsWith('.') && !name.startsWith('%');
}

// ---------------- UI Rendering ----------------

function renderProjects() {
  projectsListEl.innerHTML = '';
  projectsList.forEach(p => {
    if (!isValidName(p.name)) return;
    const div = document.createElement('div');
    div.textContent = p.name;
    div.className = 'project-item';
    if (currentProject === p.name) div.classList.add('selected');
    div.onclick = () => selectProject(p.name);
    projectsListEl.appendChild(div);
  });
  deleteProjectBtn.disabled = !currentProject;
  newFileBtn.disabled = !currentProject;
  newLibBtn.disabled = !currentProject;
  exportProjectBtn.disabled = !currentProject;
}

function renderFiles() {
  filesListEl.innerHTML = '';
  if (!currentProject) return;
  const files = Object.keys(filesData).filter(isValidName).sort();

  // Group libs (folders like __lib__)
  const libs = files.filter(f => /^__.+__$/.test(f));
  const normalFiles = files.filter(f => !/^__.+__$/.test(f));

  normalFiles.forEach(f => {
    const div = document.createElement('div');
    div.textContent = f;
    div.className = 'file-item';
    if (currentFile === f) div.classList.add('selected');
    div.onclick = () => selectFile(f);
    filesListEl.appendChild(div);
  });

  libs.forEach(f => {
    const div = document.createElement('div');
    div.textContent = f;
    div.className = 'file-item';
    if (currentFile === f) div.classList.add('selected');
    div.onclick = () => selectFile(f);

    const libLabel = document.createElement('span');
    libLabel.textContent = 'Lib';
    libLabel.className = 'lib-label';
    div.appendChild(libLabel);

    filesListEl.appendChild(div);
  });

  deleteFileBtn.disabled = !currentFile;
}

// ---------------- Event Handlers ----------------

async function selectProject(name) {
  if (currentProject === name) return;
  currentProject = name;
  const proj = await loadProject(name);
  filesData = proj?.files || {};
  currentFile = null;
  editorEl.value = '';
  editorEl.disabled = true;
  editorFilenameEl.textContent = 'No file selected';
  renderProjects();
  renderFiles();
  deleteProjectBtn.disabled = false;
  newFileBtn.disabled = false;
  newLibBtn.disabled = false;
  exportProjectBtn.disabled = false;
  deleteFileBtn.disabled = true;
  saveFileBtn.disabled = true;
}

function selectFile(name) {
  if (!name || !filesData[name]) return;
  currentFile = name;
  // For libraries (__lib__), show __init__.py or raw JSON
  if (/^__.+__$/.test(name)) {
    try {
      const libFiles = JSON.parse(filesData[name]);
      editorEl.value = libFiles['__init__.py'] || '';
      editorFilenameEl.textContent = `${name}/__init__.py`;
    } catch {
      editorEl.value = filesData[name];
      editorFilenameEl.textContent = name;
    }
  } else {
    editorEl.value = filesData[name];
    editorFilenameEl.textContent = name;
  }
  editorEl.disabled = false;
  saveFileBtn.disabled = false;
  deleteFileBtn.disabled = false;
}

async function saveCurrentFile() {
  if (!currentProject || !currentFile) return;
  if (/^__.+__$/.test(currentFile)) {
    try {
      // For libs, parse JSON and save prettified
      const libFiles = JSON.parse(editorEl.value);
      filesData[currentFile] = JSON.stringify(libFiles, null, 2);
    } catch {
      alert('Invalid JSON in library file.');
      return;
    }
  } else {
    filesData[currentFile] = editorEl.value;
  }
  await saveProject(currentProject, filesData);
  alert(`Saved "${currentFile}".`);
}

async function createNewProject() {
  let name = prompt('Enter new project name:');
  if (!name) return;
  name = name.trim();
  if (!name) {
    alert('Project name cannot be empty.');
    return;
  }
  if (projectsList.find(p => p.name === name)) {
    alert('Project with this name already exists.');
    return;
  }
  await saveProject(name, {});
  projectsList = await listProjects();
  await selectProject(name);
}

async function deleteCurrentProject() {
  if (!currentProject) return;
  if (!confirm(`Delete project "${currentProject}"? This cannot be undone.`)) return;
  await deleteProject(currentProject);
  currentProject = null;
  currentFile = null;
  filesData = {};
  projectsList = await listProjects();
  renderProjects();
  renderFiles();
  editorEl.value = '';
  editorEl.disabled = true;
  editorFilenameEl.textContent = 'No file selected';
  deleteProjectBtn.disabled = true;
  newFileBtn.disabled = true;
  newLibBtn.disabled = true;
  deleteFileBtn.disabled = true;
  saveFileBtn.disabled = true;
  exportProjectBtn.disabled = true;
}

async function createNewFile() {
  if (!currentProject) return;
  let filename = prompt('Enter new filename (must end with .py):');
  if (!filename) return;
  filename = filename.trim();
  if (!filename.endsWith('.py')) {
    alert('Filename must end with .py');
    return;
  }
  if (filesData[filename]) {
    alert('File already exists.');
    return;
  }
  filesData[filename] = '';
  await saveProject(currentProject, filesData);
  renderFiles();
}

async function deleteCurrentFile() {
  if (!currentProject || !currentFile) return;
  if (!confirm(`Delete file "${currentFile}"?`)) return;
  delete filesData[currentFile];
  currentFile = null;
  editorEl.value = '';
  editorEl.disabled = true;
  editorFilenameEl.textContent = 'No file selected';
  await saveProject(currentProject, filesData);
  renderFiles();
  saveFileBtn.disabled = true;
  deleteFileBtn.disabled = true;
}

async function createNewLibrary() {
  if (!currentProject) return;
  let libname = prompt('Enter new library name (letters, digits, underscores only):');
  if (!libname) return;
  libname = libname.trim();
  if (!/^[a-zA-Z0-9_]+$/.test(libname)) {
    alert('Library name invalid.');
    return;
  }
  const foldername = `__${libname}__`;
  if (filesData[foldername]) {
    alert('Library already exists.');
    return;
  }
  const libData = {
    '__init__.py': '',
    // optionally add '__main__.py': '' here if you want
  };
  filesData[foldername] = JSON.stringify(libData, null, 2);
  await saveProject(currentProject, filesData);
  renderFiles();
}

// ---------------- Button Listeners ----------------

newProjectBtn.onclick = createNewProject;
deleteProjectBtn.onclick = deleteCurrentProject;
newFileBtn.onclick = createNewFile;
deleteFileBtn.onclick = deleteCurrentFile;
newLibBtn.onclick = createNewLibrary;
saveFileBtn.onclick = saveCurrentFile;
exportProjectBtn.onclick = () => {
  if (!currentProject) return;
  exportProject(currentProject, filesData);
};

// ---------------- Initialization ----------------

async function init() {
  await openDB();
  projectsList = await listProjects();
  renderProjects();
  renderFiles();
  editorEl.value = '';
  editorEl.disabled = true;
  editorFilenameEl.textContent = 'No file selected';
  deleteProjectBtn.disabled = true;
  newFileBtn.disabled = true;
  newLibBtn.disabled = true;
  deleteFileBtn.disabled = true;
  saveFileBtn.disabled = true;
  exportProjectBtn.disabled = true;
}

window.onload = init;