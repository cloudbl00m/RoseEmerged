import { createRose } from '/rose.js';

const byId = id => document.getElementById(id);
const edit = byId('edit');
const fields = edit.elements;
const login = byId('login');
const feedback = byId('feedback');
const rose = createRose();
rose.element.setAttribute('viewBox', '0 -48 260 288');
byId('rose').append(rose.element);
let projects = [];
let selected = null;
let dirty = false;
let busy = false;
let authMode = 'password';

function report(message, error = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
}

function signedOut() {
  projects = [];
  choose(null);
  drawList();
  login.reset();
  byId('studio').hidden = true;
  byId('signout').hidden = true;
  byId('signin').hidden = false;
}

async function request(path, method = 'GET', data) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path.startsWith('/api/admin/')) signedOut();
    const error = new Error(result?.error || 'The request failed. Please try again.');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function perform(task) {
  if (busy) return;
  busy = true;
  document.querySelector('main').inert = true;
  try { await task(); }
  catch (error) { report(error.message, true); }
  finally {
    busy = false;
    document.querySelector('main').inert = false;
  }
}

function choose(project) {
  selected = project?.id ?? null;
  edit.reset();
  for (const key of ['title', 'type', 'description', 'thumbnail', 'url']) {
    fields[key].value = project?.[key] ?? '';
  }
  fields.published.checked = Boolean(project?.published);
  const completion = project?.completion ?? 0;
  byId('percent').value = byId('range').value = completion;
  rose.setGrowth(completion);
  byId('editor-title').textContent = project ? 'Edit project' : 'New project';
  byId('delete').hidden = !project;
  dirty = false;
}

function canDiscard() {
  return !dirty || window.confirm('Discard your unsaved project changes?');
}

function drawList() {
  const list = byId('projects');
  list.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No projects yet.';
    list.append(empty);
  }
  projects.forEach((project, index) => {
    const row = document.createElement('li');
    const chooser = document.createElement('button');
    chooser.className = 'choose';
    chooser.setAttribute('aria-current', String(project.id === selected));
    const title = document.createElement('strong');
    title.textContent = project.title;
    const status = document.createElement('small');
    status.textContent = [project.published ? 'Published' : 'Draft', project.completion + '%', ...(project.sample ? ['Sample'] : [])].join(' · ');
    chooser.append(title, status);
    chooser.addEventListener('click', () => {
      if (project.id === selected || !canDiscard()) return;
      choose(project);
      drawList();
      report('');
      fields.title.focus();
    });
    const order = document.createElement('div');
    order.className = 'order';
    for (const [delta, arrow, word] of [[-1, '↑', 'earlier'], [1, '↓', 'later']]) {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Move ' + project.title + ' ' + word);
      button.textContent = arrow;
      button.disabled = !projects[index + delta];
      button.addEventListener('click', () => perform(async () => {
        const ids = projects.map(item => item.id);
        [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
        await request('/api/admin/order', 'POST', { ids });
        await reload();
        report('Project order saved.');
      }));
      order.append(button);
    }
    row.append(chooser, order);
    list.append(row);
  });
}

async function reload() {
  projects = await request('/api/admin/projects');
  drawList();
}
async function openStudio() {
  await reload();
  choose(projects[0]);
  drawList();
  byId('signin').hidden = true;
  byId('studio').hidden = false;
  byId('signout').hidden = false;
  report('');
}

login.addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    await request('/api/login', 'POST', Object.fromEntries(new FormData(login)));
    login.reset();
    await openStudio();
  });
});
byId('signout').addEventListener('click', () => {
  if (!canDiscard()) return;
  if (authMode === 'chatgpt') {
    window.location.assign('/signout-with-chatgpt');
    return;
  }
  perform(async () => {
    await request('/api/logout', 'POST');
    signedOut();
    report('Signed out.');
  });
});
byId('new').addEventListener('click', () => {
  if (!canDiscard()) return;
  choose(null);
  drawList();
  report('');
  fields.title.focus();
});
edit.addEventListener('input', () => { dirty = true; });
byId('range').addEventListener('input', event => {
  byId('percent').value = event.target.value;
  rose.setGrowth(Number(event.target.value));
});
byId('percent').addEventListener('input', event => {
  if (!event.target.validity.valid) return;
  byId('range').value = event.target.value;
  rose.setGrowth(event.target.valueAsNumber);
});
edit.addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    const editing = selected !== null;
    const data = Object.fromEntries(['title', 'type', 'description', 'thumbnail', 'url']
      .map(key => [key, fields[key].value.trim()]));
    data.completion = byId('percent').valueAsNumber;
    data.published = fields.published.checked;
    const path = '/api/admin/projects' + (editing ? '/' + encodeURIComponent(selected) : '');
    const saved = await request(path, editing ? 'PUT' : 'POST', data);
    await reload();
    const record = projects.find(project => project.id === (saved?.id ?? selected));
    choose(record);
    drawList();
    report(data.published ? 'Project saved and published in the garden.' : 'Draft saved. Only signed-in gardeners can see it.');
  });
});

const confirmation = byId('confirmation');
byId('delete').addEventListener('click', () => {
  const current = projects.find(project => project.id === selected);
  if (!current) return;
  byId('delete-info').textContent = '“' + current.title + '” will be permanently removed from the studio and garden.';
  confirmation.returnValue = '';
  confirmation.showModal();
});
confirmation.addEventListener('close', () => {
  if (confirmation.returnValue !== 'delete') return;
  perform(async () => {
    await request('/api/admin/projects/' + encodeURIComponent(selected), 'DELETE');
    await reload();
    choose(projects[0]);
    drawList();
    report('Project deleted.');
  });
});
window.addEventListener('pageshow', event => {
  if (event.persisted) window.location.reload();
});

perform(async () => {
  const config = await request('/api/auth-mode');
  authMode = config.mode;
  if (authMode === 'chatgpt') {
    login.hidden = true;
    const link = document.createElement('a');
    link.className = 'login-link primary';
    link.href = '/signin-with-chatgpt?return_to=%2Fadmin';
    link.textContent = 'Sign in with ChatGPT';
    login.after(link);
  }
  try { await openStudio(); }
  catch (error) {
    signedOut();
    report(error.status === 401 ? '' : error.message, error.status !== 401);
  }
});

