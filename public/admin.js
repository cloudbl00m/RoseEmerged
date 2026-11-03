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
  fields.skills.value=(project?.skills||[]).join(', ');
  fields.skills.dispatchEvent(new Event('input'));
  byId('upload-feedback').textContent='';
  thumbnailPreview();
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
  await loadTeam();
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
    data.skills=parseTags(fields.skills.value);
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


function parseTags(value) {
  return [...new Set(value.split(',').map(tag=>tag.trim()).filter(Boolean))];
}
function tagPreview(input,container) {
  function draw() {
    const values=parseTags(input.value);
    const tooLong=values.find(tag=>tag.length>120);
    const limit=input.name==='teamSkills'?48:24;
    input.setCustomValidity(tooLong ? 'Tag “'+tooLong.slice(0,45)+'…” exceeds 120 characters.' : values.length>limit ? 'Use up to '+limit+' tags.' : '');
    container.replaceChildren();
    for(const tag of parseTags(input.value)) {
      const chip=document.createElement('button');
      chip.type='button';
      chip.textContent=tag+' ×';
      chip.setAttribute('aria-label','Remove '+tag);
      chip.addEventListener('click',()=>{
        input.value=parseTags(input.value).filter(item=>item!==tag).join(', ');
        input.dispatchEvent(new Event('input',{bubbles:true}));
      });
      container.append(chip);
    }
  }
  input.addEventListener('input',draw);
  draw();
}
const teamForm=byId('team-form');
tagPreview(fields.skills,byId('project-tags'));
tagPreview(teamForm.elements.teamSkills,byId('team-tags'));
async function loadTeam() {
  const data=await request('/api/admin/team');
  const members=Array.isArray(data)?data:data.members;
  for(const member of members) teamForm.elements[member.id+'Bio'].value=member.bio;
  const skills=Array.isArray(data)?[...new Set(data.flatMap(member=>member.skills||[]))]:data.skills;
  teamForm.elements.teamSkills.value=(skills||[]).join(', ');
  teamForm.elements.teamSkills.dispatchEvent(new Event('input'));
}
teamForm.addEventListener('submit',event=>{
  event.preventDefault();
  perform(async()=>{
    const members=['akai','hoor'].map(id=>({
      id,bio:teamForm.elements[id+'Bio'].value.trim()
    }));
    await request('/api/admin/team','PUT',{members,skills:parseTags(teamForm.elements.teamSkills.value)});
    byId('team-feedback').textContent='Team profiles and skill tags saved.';
    report('Team profiles saved and visible below the garden.');
  });
});

function thumbnailPreview() {
  const image=byId('thumbnail-preview');
  const value=fields.thumbnail.value.trim();
  image.hidden=!value;
  byId('remove-thumbnail').hidden=!value;
  if(value) image.src=value;
  else image.removeAttribute('src');
}
fields.thumbnail.addEventListener('input',thumbnailPreview);
byId('remove-thumbnail').addEventListener('click',()=>{
  fields.thumbnail.value='';
  byId('thumbnail-file').value='';
  dirty=true;
  thumbnailPreview();
  byId('upload-feedback').textContent='Thumbnail removed. Save the project to apply.';
});
byId('thumbnail-file').addEventListener('change',()=>{
  const file=byId('thumbnail-file').files[0];
  if(!file) return;
  perform(async()=>{
    const status=byId('upload-feedback');
    status.textContent='Preparing image…';
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG, or WebP image.');
      if(file.size>10*1024*1024) throw Error('Choose an image up to 10 MB.');
      const bitmap=await createImageBitmap(file);
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
      if(!blob) throw Error('This image could not be prepared.');
      status.textContent='Uploading image…';
      const response=await fetch('/api/admin/uploads',{method:'POST',headers:{'Content-Type':blob.type},body:blob,credentials:'same-origin'});
      const result=await response.json();
      if(!response.ok) throw Error(result.error||'Upload failed. Try again.');
      fields.thumbnail.value=result.url;
      dirty=true;
      thumbnailPreview();
      status.textContent='Image uploaded. Save the project to apply this thumbnail.';
    } catch(error) {
      status.textContent=error.message;
      throw error;
    } finally { byId('thumbnail-file').value=''; }
  });
});
