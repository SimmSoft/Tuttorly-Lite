  const storeKey = 'tuttorly.v11';
  const el = id => document.getElementById(id);

  let state = load();
  let currentId = null;
  let currentView = 'students';
  let pendingDeleteId = null;
  let tempChangeFromDayPopup = false;

  // --- Safe History helpers (no-ops on sandbox/about:srcdoc) ---
  function canUseHistory(){
    try{ return !location.href.startsWith('about:') && !!history.pushState; }catch{ return false; }
  }
  function safePush(url, st){ if(!canUseHistory()) return; try{ history.pushState(st||{}, '', url||location.href); }catch{} }
  function safeReplace(url, st){ if(!canUseHistory()) return; try{ history.replaceState(st||{}, '', url||location.href); }catch{} }

  function uid(){ return Math.random().toString(36).slice(2,10); }
  function formatPLN(n){ try{ return new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN', maximumFractionDigits:0}).format(n);}catch{ return Math.round(n)+' zł'; } }
  function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }
  function normalizeState(data){
    const d = (data && typeof data === 'object') ? data : {};
    if(!Array.isArray(d.students)) d.students = [];
    d.students.forEach((s,i)=>{ if(typeof s.order!=="number") s.order=i; if(!s.pricing) s.pricing={}; });
    if(!Array.isArray(d.earnings)) d.earnings = [];
    d.earnings.forEach(e=>{
      if(!Array.isArray(e.studentIds)) e.studentIds = [];
      if(typeof e.noteText !== 'string') e.noteText = (e.description || '');
    });
    return d;
  }
  function load(){ const raw = localStorage.getItem(storeKey); if(raw){ try{ const d=normalizeState(JSON.parse(raw)); return d; }catch{} }
    return normalizeState({ students:[
      {id:uid(), order:0, name:'Anna Nowak', place:'Zielona Góra', notes:'Matematyka, 7 klasa', balance:10, pricing:{remote60:60, remote90:90, remote120:120, station60:80, station90:110, station120:140}, active:{type:'remote', dur:60}},
      {id:uid(), order:1, name:'Jan Kowalski', place:'Wrocław', notes:'Fizyka, matura', balance:-10, pricing:{remote60:70, remote90:100, remote120:120, station60:90, station90:130, station120:160}, active:{type:'station', dur:90}}
    ], earnings:[] }); }

  window.addEventListener('load', ()=>{ setTimeout(()=>{ const s = el('splash'); if(s) s.style.display='none'; el('phone').classList.add('show'); }, 1200); });

  // View switching for tabs
  function switchTab(tabName){
    // Close detail view when switching tabs
    if(el('detailView') && el('detailView').style.display === 'flex'){
      setView('list');
      currentId = null;
    }

    // Update tab active state
    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    const activeTab = document.querySelector(`.tabs .tab[data-view="${tabName}"]`);
    if(activeTab) activeTab.classList.add('active');

    // Update view visibility
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.classList.remove('active'));
    const activeView = el(tabName + 'View');
    if(activeView) activeView.classList.add('active');

    // Update FAB style and render view
    const fab = el('addBtn');
    if(tabName === 'stats'){
      if(fab) { fab.classList.add('dark'); fab.style.display='grid'; }
            // Initialize current month and year if not set
      const monthDisplay = el('monthDisplay');
     if(monthDisplay && monthDisplay.textContent.includes('październik 2025')){
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayYear = today.getFullYear();
       const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
        monthDisplay.textContent = monthInv[todayMonth] + ' ' + todayYear;
      }
      renderStats();
      renderEarnings();
    } else if(tabName === 'terminy'){
      if(fab) fab.style.display='none';
    } else {
      if(fab) { fab.classList.remove('dark'); fab.style.display='grid'; }
    }

    currentView = tabName;
  }

  // Tab click handlers
  el('terminyTab')?.addEventListener('click', ()=>{ switchTab('terminy'); });
  el('studentsTab')?.addEventListener('click', ()=>{ switchTab('students'); });
  el('statsTab')?.addEventListener('click', ()=>{ switchTab('stats'); });

  // ===== SWIPE NAVIGATION =====
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  const SWIPE_THRESHOLD = 50; // pixels
  const SWIPE_TIME_THRESHOLD = 300; // milliseconds

  function handleSwipe(direction){
    if(direction === 'left'){
      if(currentView === 'terminy') switchTab('students');
      else if(currentView === 'students') switchTab('stats');
    } else if(direction === 'right'){
      if(currentView === 'stats') switchTab('students');
      else if(currentView === 'students') switchTab('terminy');
    }
  }

  // Touch start
  document.addEventListener('touchstart', (e)=>{
    // Don't swipe if touching input/textarea or if modals are open
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if(e.target.closest('.drag-handle')) return; // Ignore drag-handle
    if(e.target.closest('button')) return; // Ignore buttons
    if(dialog && dialog.style.display === 'flex') return;
    if(el('incomeDialogWrap') && el('incomeDialogWrap').style.display === 'flex') return;
    if(el('monthSelectorWrap') && el('monthSelectorWrap').style.display === 'flex') return;
    if(el('yearSelectorWrap') && el('yearSelectorWrap').style.display === 'flex') return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, false);

  // Touch end
  document.addEventListener('touchend', (e)=>{
    // Ignore if inputs are involved or if dragging is active
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if(dragEl) return; // Don't swipe if drag is active
    if(e.target.closest('.drag-handle')) return;
    if(e.target.closest('button')) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const deltaTime = touchEndTime - touchStartTime;

    // Ensure it's a horizontal swipe (not vertical scroll)
    if(Math.abs(deltaY) > Math.abs(deltaX)) return;
    if(deltaTime > SWIPE_TIME_THRESHOLD) return;
    if(Math.abs(deltaX) < SWIPE_THRESHOLD) return;

    // Determine swipe direction
    if(deltaX > 0){
      handleSwipe('right');
    } else {
      handleSwipe('left');
    }
  }, false);

  function setView(which){
    const list = el('listView');
    const detail = el('detailView');
    const fab = el('addBtn');
    const studentsView = el('studentsView');
    
    if(which==='detail'){
      studentsView && (studentsView.style.display='none');
      detail && (detail.style.display='flex');
      fab && (fab.style.display='none');
    } else {
      studentsView && (studentsView.style.display='flex');
      detail && (detail.style.display='none');
      fab && (fab.style.display='grid');
    }
  }

  document.addEventListener('click', (e)=>{
    const backBtn = e.target.closest ? e.target.closest('#inlineBack') : null;
    if(backBtn){
      if(dialog && dialog.style.display==='flex'){ closeDialog(); return; }
      setView('list');
    }
  });

  function renderList(){
    const list = el('listView'); if(!list) return; list.innerHTML='';
    if(!state.students.length){ list.innerHTML = `<div class="emptyState">Brak uczniów.<br>Kliknij + aby dodać.</div>`; return; }
    list.innerHTML = `<div class="studentCount">Liczba uczniów: ${state.students.length}</div>`;
    const sorted = state.students.slice().sort((a,b)=> (a.order??0)-(b.order??0));
    sorted.forEach(s=>{
      const card = document.createElement('div'); card.className='card'; card.dataset.id=s.id;
      const initials=(s.name||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
      const avatar = s.avatar? `<img src="${s.avatar}" alt="">` : initials;
      const handleSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
      card.innerHTML = `
        <div class="drag-handle" title="Zmień kolejność">${handleSvg}</div>
        <div class="avatar">${avatar}</div>
        <div class="meta"><div class="name">${escapeHtml(s.name)}</div><div class="sub">${escapeHtml(s.place||'—')}</div></div>
        <div class="amount ${s.balance>0?'pos':(s.balance<0?'neg':'')}">${formatPLN(s.balance)}</div>`;
      enableCardDnD(card, s.id);
      list.appendChild(card);
    });
  }

  let dragEl=null, placeholder=null, startX=0, startY=0, offsetY=0, lpTimer=null, dragStarted=false;
  const LP_MS=450, SLOP=8;
  function enableCardDnD(card, id) {
    const handle = card.querySelector('.drag-handle');
    const list = el('listView');

    // Click on card to select
    card.addEventListener('click', (e) => {
        if (e.target.closest('.drag-handle')) return;
        selectStudent(id);
    });

    // Drag from handle
    handle.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return; // Only left mouse button
        e.preventDefault();
        e.stopPropagation();
        startDrag(card, e);
        handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
        if (dragEl) moveDrag(e);
    });

    const endDragHandler = () => {
        if (dragEl) endDrag();
    };
    handle.addEventListener('pointerup', endDragHandler);
    handle.addEventListener('pointercancel', endDragHandler);

    // --- DnD Helper Functions (Copied from original) ---
    function startDrag(node, e) {
        dragEl = node;
        dragEl.classList.add('dragging');
        const r = dragEl.getBoundingClientRect();
        offsetY = e.clientY - r.top;
        placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.style.height = r.height + 'px';
        dragEl.parentNode.insertBefore(placeholder, dragEl.nextSibling);
        dragEl.style.position = 'fixed';
        dragEl.style.left = r.left + 'px';
        dragEl.style.width = r.width + 'px';
        dragEl.style.top = r.top + 'px';
        dragEl.style.zIndex = 50;
        document.body.appendChild(dragEl);
        moveDrag(e);
    }

    function moveDrag(e) {
        if (!dragEl) return;
        dragEl.style.top = (e.clientY - offsetY) + 'px';
        const cards = Array.from(list.children).filter(x => x !== placeholder && !x.classList.contains('dragging'));
        const midY = e.clientY;
        let target = null;
        for (const c of cards) {
            const r = c.getBoundingClientRect();
            if (midY < r.top + r.height / 2) {
                target = c;
                break;
            }
        }
        if (target) {
            list.insertBefore(placeholder, target);
        } else {
            list.appendChild(placeholder);
        }
    }

    function endDrag() {
        if (!dragEl) return;
        placeholder.parentNode.insertBefore(dragEl, placeholder);
        dragEl.style.position = '';
        dragEl.style.left = '';
        dragEl.style.top = '';
        dragEl.style.width = '';
        dragEl.style.zIndex = '';
        dragEl.classList.remove('dragging');
        placeholder.remove();
        
        const ids = Array.from(el('listView').children).map(x => x.dataset.id).filter(Boolean);
        ids.forEach((sid, i) => {
            const s = state.students.find(o => o.id === sid);
            if (s) s.order = i;
        });
        save();
        dragEl = null;
        placeholder = null;
        renderList();
    }
  }

  function escapeHtml(str){ return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function normalizeText(str){ return (str||'').toString().toLowerCase(); }
  function getStudentById(id){ return state.students.find(s => s.id === id); }
  function getStudentDisplayNameById(id){ const s = getStudentById(id); return s ? s.name : ''; }
  function getLessonDisplayName(lesson){
    if(lesson && lesson.studentId){ const name = getStudentDisplayNameById(lesson.studentId); if(name) return name; }
    if(lesson && lesson.customName) return lesson.customName;
    if(lesson && lesson.student) return lesson.student;
    return '';
  }
  function getEarningDescription(entry){
    const ids = Array.isArray(entry?.studentIds) ? entry.studentIds : [];
    const names = ids.map(getStudentDisplayNameById).filter(Boolean);
    let note = (entry?.noteText || entry?.description || '').trim();
    if(names.length && note){
      const noteNorm = normalizeText(note);
      const joinedNorm = normalizeText(names.join(', '));
      const matchSingle = names.some(n => normalizeText(n) === noteNorm);
      if(matchSingle || noteNorm === joinedNorm) note = '';
    }
    if(names.length && note) return `${names.join(', ')}, ${note}`;
    if(names.length) return names.join(', ');
    return note;
  }
  function getStudentsMatching(query){
    const q = normalizeText(query).trim();
    if(q.length < 2) return [];
    return state.students.filter(s => normalizeText(s.name).includes(q));
  }
  function renderStudentSuggestions(listEl, query, excludeIds){
    const matches = getStudentsMatching(query).filter(s => !excludeIds || !excludeIds.includes(s.id));
    if(!listEl) return;
    if(matches.length === 0){
      listEl.style.display = 'none';
      listEl.innerHTML = '';
      return;
    }
    listEl.innerHTML = matches.map(s => (
      `<div class="studentPickerItem" data-id="${s.id}">` +
      `<span>${escapeHtml(s.name)}</span>` +
      `<span class="muted">${escapeHtml(s.place || '')}</span>` +
      `</div>`
    )).join('');
    listEl.style.display = 'block';
  }
  function setupStudentPickerSingle(input, listEl, onSelect){
    if(!input || !listEl) return;
    const hide = ()=>{ listEl.style.display='none'; };
    const render = ()=>{ renderStudentSuggestions(listEl, input.value, []); };
    input.addEventListener('input', ()=>{ onSelect(null); render(); });
    input.addEventListener('focus', ()=>{ render(); });
    listEl.addEventListener('mousedown', (e)=>{
      const item = e.target.closest('.studentPickerItem');
      if(!item) return;
      const id = item.dataset.id;
      onSelect(id);
      input.value = getStudentDisplayNameById(id) || '';
      hide();
    });
    document.addEventListener('click', (e)=>{
      if(e.target === input) return;
      if(listEl.contains(e.target)) return;
      hide();
    });
  }

  function selectStudent(id){
    currentId=id; const s=state.students.find(x=>x.id===id); if(!s) return;
    setView('detail'); setReadOnly(true);
    el('dName').value=s.name||''; 
    el('dPlace').value=s.place||''; 
    el('dNotes').value=s.notes||'';
    el('dLocation').value=s.place||'';
    updateNotesDisplay();
    renderAvatar(s); renderBalance(s.balance); updateMap(s.place); renderActiveSummary();
    safePush('#detail-'+id, {screen:'detail', id}); // no-op in sandbox

    const mapWrap = el('map').parentNode;
    if (mapWrap) mapWrap.style.display = 'none';
    const toggleBtn = el('toggleMapBtn');
    if (toggleBtn) toggleBtn.textContent = 'Pokaż mapę';
  }

  function renderAvatar(s){ const dA=el('dAvatar'); dA.innerHTML=''; if(s.avatar){ const img=document.createElement('img'); img.src=s.avatar; img.alt='avatar'; dA.appendChild(img);} else { dA.textContent=(s.name||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase(); } }
  function renderBalance(val){
    const b=el('dBalance');
    const abs = Math.abs(Number(val)||0);
    const formatted = formatPLN(abs);
    b.textContent = val>0 ? `+${formatted}` : (val<0 ? `-${formatted}` : formatPLN(0));
    b.classList.remove('pos','neg');
    if(val>0)b.classList.add('pos');
    if(val<0)b.classList.add('neg');
    renderRequiredAmount(val);
    evaluateFree();
  }
  function renderRequiredAmount(balanceOverride){
    const reqEl = el('dRequired'); if(!reqEl) return;
    const s=state.students.find(x=>x.id===currentId); if(!s) return;
    const price = getActivePrice();
    const balance = (typeof balanceOverride==='number') ? balanceOverride : (Number(s.balance)||0);
    const required = Math.max(0, (Number(price)||0) - balance);
    reqEl.textContent = formatPLN(required);
  }
  function setReadOnly(ro){ el('detailView').classList.toggle('readonly', !!ro); }
  function updateMap(place){ const map=el('map'); const q=encodeURIComponent(place||'Polska'); map.src=`https://maps.google.com/maps?q=${q}&z=14&output=embed`; }

  // Update notes display and toggle expandable
  function updateNotesDisplay(){
    const notes = el('dNotes').value || '';
    const notesToggle = el('notesToggle');
    const display = el('dNotesDisplay');
    if(display) display.textContent = notes;
    if(notesToggle) notesToggle.style.display = notes.length > 0 ? 'block' : 'none';
    // Reset to collapsed state (3 linijki) when loading student
    if(notesToggle) notesToggle.classList.remove('expanded');
    if(display) display.classList.remove('show');
  }

  // Notes toggle handler - expand/collapse
  el('notesToggle')?.addEventListener('click', ()=>{
    const notesToggle = el('notesToggle');
    const display = el('dNotesDisplay');
    if(notesToggle) notesToggle.classList.toggle('expanded');
    if(display) display.classList.toggle('show');
  });

  ['dName','dPlace','dNotes'].forEach(id=>{ el(id).addEventListener('input',()=>{ 
    if(el('detailView').classList.contains('readonly')) { if(id==='dNotes') updateNotesDisplay(); return; }
    const s=state.students.find(x=>x.id===currentId); if(!s) return; 
    s.name=el('dName').value.trim(); 
    s.place=el('dPlace').value.trim(); 
    s.notes=el('dNotes').value.trim(); 
    el('dLocation').value=s.place;
    save(); renderList(); updateMap(s.place); renderAvatar(s); renderActiveSummary(); updateNotesDisplay();
  }); });

  // Sync dLocation display with dPlace
  el('dPlace')?.addEventListener('input', ()=>{ 
    el('dLocation').value = el('dPlace').value;
  });

  function getActivePrice(){ const s=state.students.find(x=>x.id===currentId); if(!s) return 0; const key=(s.active?.type==='station'?'station':'remote')+String(s.active?.dur||60); const v=s.pricing?.[key]??0; return Number(v)||0; }
  function renderActiveSummary(){ const s=state.students.find(x=>x.id===currentId); if(!s) return; const typeLabel=(s.active?.type==='station')?'Stacjonarne':'Zdalne'; const dur=s.active?.dur||60; const price=getActivePrice(); const badge=el('activeBadge'); const priceBadge=el('priceBadge'); if(badge) badge.textContent=`${typeLabel}: ${dur} min`; if(priceBadge) priceBadge.textContent=`Cena: ${price?formatPLN(price):''}`; renderRequiredAmount(); evaluateFree(); }
  function evaluateFree(){ const s=state.students.find(x=>x.id===currentId); if(!s) return; const p=getActivePrice(); const wrap=el('balanceWrap'); const badge=el('freeBadge'); const ok=p>0 && s.balance===p; if(wrap) wrap.classList.toggle('highlight', ok); if(badge) badge.style.display= ok? 'inline-block':'none'; }

  function applyDelta(d){ const s=state.students.find(x=>x.id===currentId); if(!s) return; s.balance=Math.round(s.balance+d); save(); renderBalance(s.balance); renderList(); }
  function resetBalance(){ const s=state.students.find(x=>x.id===currentId); if(!s) return; s.balance=0; save(); renderBalance(s.balance); renderList(); }

  const dialog=el('dialogWrap');
  function updateAvatarPreviewFrom(name, dataurl){
    const prev = el('avatarPreview'); if(!prev) return;
    prev.innerHTML='';
    if(dataurl){ const img=document.createElement('img'); img.src=dataurl; img.alt='avatar'; prev.appendChild(img); return; }
    const initials=(name||'')?.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase() || 'A';
    prev.textContent=initials;
  }

  function openDialog(editId){ if(!dialog) return; dialog.style.display='flex';
    const title=el('dialogTitle'); const sName=el('sName'); const sPlace=el('sPlace'); const sNotes=el('sNotes');
    const pR60=el('priceR60'); const pR90=el('priceR90'); const pR120=el('priceR120'); const pS60=el('priceS60'); const pS90=el('priceS90'); const pS120=el('priceS120');
    const aInfo=el('avatarInfo'); const aType=el('activeType'); const aDur=el('activeDur'); const delBtn=el('deleteBtn');

    if(editId){ const s=state.students.find(x=>x.id===editId); if(!s) return;
      title && (title.textContent='Edytuj ucznia'); sName && (sName.value=s.name||''); sPlace && (sPlace.value=s.place||''); sNotes && (sNotes.value=s.notes||'');
      pR60 && (pR60.value=s.pricing?.remote60??''); pR90 && (pR90.value=s.pricing?.remote90??''); pR120 && (pR120.value=s.pricing?.remote120??'');
      pS60 && (pS60.value=s.pricing?.station60??''); pS90 && (pS90.value=s.pricing?.station90??''); pS120 && (pS120.value=s.pricing?.station120??'');
      aInfo && (aInfo.textContent=s.avatar?'ustawiono':'(opcjonalnie)');
      aType && (aType.value=s.active?.type||'remote'); aDur && (aDur.value=String(s.active?.dur||60)); dialog.dataset.editId=editId;
      if(delBtn) delBtn.style.display='inline-flex';
      updateAvatarPreviewFrom(s.name, s.avatar);
    } else {
      title && (title.textContent='Nowy uczeń'); sName && (sName.value=''); sPlace && (sPlace.value=''); sNotes && (sNotes.value='');
      pR60 && (pR60.value=''); pR90 && (pR90.value=''); pR120 && (pR120.value=''); pS60 && (pS60.value=''); pS90 && (pS90.value=''); pS120 && (pS120.value='');
      aInfo && (aInfo.textContent='(opcjonalnie)'); aType && (aType.value='remote'); aDur && (aDur.value='60'); delete dialog.dataset.editId;
      if(delBtn) delBtn.style.display='none';
      updateAvatarPreviewFrom('', null);
    }
    setTimeout(()=>sName&&sName.focus(),50);
  }
  function closeDialog(){ dialog && (dialog.style.display='none'); }
  function closeIncomeDialog(){ const incomeDialog=el('incomeDialogWrap'); if(incomeDialog) incomeDialog.style.display='none'; }
  
  el('addBtn')?.addEventListener('click',()=>{ 
    if(currentView==='students'){ openDialog(); } 
    else if(currentView==='stats'){ openIncomeDialog(); }
  });

  // Month navigation for stats
  el('prevMonth')?.addEventListener('click', ()=>{
    const monthDisplay = el('monthDisplay');
    if(!monthDisplay) return;
    const monthStr = monthDisplay.textContent;
    const [monthName, yearStr] = monthStr.split(' ');
    const monthMap = {'styczeń':1, 'luty':2, 'marzec':3, 'kwiecień':4, 'maj':5, 'czerwiec':6, 'lipiec':7, 'sierpień':8, 'wrzesień':9, 'październik':10, 'listopad':11, 'grudzień':12};
    const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
    let month = monthMap[monthName.toLowerCase()] || 10;
    let year = parseInt(yearStr) || 2025;
    month--; if(month < 1){ month = 12; year--; }
    monthDisplay.textContent = monthInv[month] + ' ' + year;
    renderStats(); renderEarnings();
  });

  el('nextMonth')?.addEventListener('click', ()=>{
    const monthDisplay = el('monthDisplay');
    if(!monthDisplay) return;
    const monthStr = monthDisplay.textContent;
    const [monthName, yearStr] = monthStr.split(' ');
    const monthMap = {'styczeń':1, 'luty':2, 'marzec':3, 'kwiecień':4, 'maj':5, 'czerwiec':6, 'lipiec':7, 'sierpień':8, 'wrzesień':9, 'październik':10, 'listopad':11, 'grudzień':12};
    const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
    let month = monthMap[monthName.toLowerCase()] || 10;
    let year = parseInt(yearStr) || 2025;
    month++; if(month > 12){ month = 1; year++; }
    monthDisplay.textContent = monthInv[month] + ' ' + year;
    renderStats(); renderEarnings();
  });

  // Month selector modal
  let selectedYearInModal = new Date().getFullYear();
  
  el('monthDisplay')?.addEventListener('click', openMonthSelector);
  el('monthSelectorWrap')?.addEventListener('click', (e) => {
    if(e.target === el('monthSelectorWrap')) closeMonthSelector();
  });
  el('yearSelectorWrap')?.addEventListener('click', (e) => {
    if(e.target === el('yearSelectorWrap')) closeYearSelector();
  });

  function openMonthSelector(){
    const monthDisplay = el('monthDisplay');
    const monthStr = monthDisplay.textContent;
    const [monthName, yearStr] = monthStr.split(' ');
    const monthMap = {'styczeń':1, 'luty':2, 'marzec':3, 'kwiecień':4, 'maj':5, 'czerwiec':6, 'lipiec':7, 'sierpień':8, 'wrzesień':9, 'październik':10, 'listopad':11, 'grudzień':12};
    const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
    const currentMonth = monthMap[monthName.toLowerCase()] || 10;
    const year = parseInt(yearStr) || 2025;
    
    selectedYearInModal = year;
    el('yearDisplay').textContent = year;
    
    // Chart will use the year from monthDisplay selector
    
    renderMonthGrid(year, currentMonth);
    el('monthSelectorWrap').style.display = 'flex';
  }

  function renderMonthGrid(year, currentMonth){
    const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
    const grid = el('monthSelectorGrid');
    grid.innerHTML = '';
    
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();
    
    for(let m = 1; m <= 12; m++){
      const monthNameStr = monthInv[m];
      let totalEarnings = 0;
      
      (state.earnings || []).forEach(entry => {
        const d = new Date(entry.date + 'T00:00:00');
        if(d.getMonth() + 1 === m && d.getFullYear() === year){
          totalEarnings += entry.amount;
        }
      });
      
      const btn = document.createElement('button');
      btn.className = 'monthBtn';
      if(m === currentMonth) btn.classList.add('active');
      if(m === todayMonth && year === todayYear) btn.classList.add('current');
      btn.innerHTML = `<div style="font-weight:700">${monthNameStr}</div><div style="font-size:11px; opacity:0.8">${formatPLN(totalEarnings)}</div>`;
      btn.addEventListener('click', () => selectMonth(m, year, currentMonth));
      grid.appendChild(btn);
    }
  }

  function closeMonthSelector(){
    el('monthSelectorWrap').style.display = 'none';
  }

  function openYearSelector(){
    const today = new Date();
    const currentYear = today.getFullYear();
    const dropdown = el('yearDropdown');
    dropdown.innerHTML = '';
    
    // Generate years from currentYear - 5 to currentYear + 5
    for(let y = currentYear - 5; y <= currentYear + 5; y++){
      const option = document.createElement('button');
      option.className = 'yearOption';
      if(y === selectedYearInModal) option.classList.add('active');
      option.textContent = y;
      option.addEventListener('click', () => selectYear(y));
      dropdown.appendChild(option);
    }
    
    el('yearSelectorWrap').style.display = 'flex';
  }

  function closeYearSelector(){
    el('yearSelectorWrap').style.display = 'none';
  }

  function selectYear(year){
    selectedYearInModal = year;
    el('yearDisplay').textContent = year;
    const monthDisplay = el('monthDisplay');
    const monthStr = monthDisplay.textContent;
    const [monthName] = monthStr.split(' ');
    const monthMap = {'styczeń':1, 'luty':2, 'marzec':3, 'kwiecień':4, 'maj':5, 'czerwiec':6, 'lipiec':7, 'sierpień':8, 'wrzesień':9, 'październik':10, 'listopad':11, 'grudzień':12};
    const currentMonth = monthMap[monthName.toLowerCase()] || 10;
    renderMonthGrid(year, currentMonth);
    closeYearSelector();
  }

  function selectMonth(month, year, currentMonth){
    const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
    el('monthDisplay').textContent = monthInv[month] + ' ' + year;
    renderStats(); renderEarnings();
    closeMonthSelector();
  }

  function goToToday(){
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();
    const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
    el('monthDisplay').textContent = monthInv[todayMonth] + ' ' + todayYear;
    renderStats(); renderEarnings();
    closeMonthSelector();
  }

  // Initialize stats view with current month and year on app start
  (function initializeCurrentMonth(){
    const monthDisplay = el('monthDisplay');
    if(monthDisplay && monthDisplay.textContent.includes('październik 2025')){
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayYear = today.getFullYear();
      const monthInv = {1:'styczeń', 2:'luty', 3:'marzec', 4:'kwiecień', 5:'maj', 6:'czerwiec', 7:'lipiec', 8:'sierpień', 9:'wrzesień', 10:'październik', 11:'listopad', 12:'grudzień'};
      monthDisplay.textContent = monthInv[todayMonth] + ' ' + todayYear;
    }
  })();
  el('editBtn')?.addEventListener('click',()=>{ if(currentId){ openDialog(currentId); setReadOnly(false);} });
  el('cancelDialog')?.addEventListener('click',()=>{ closeDialog(); });
  el('deleteBtn')?.addEventListener('click',()=>{
    if(!dialog?.dataset.editId) return;
    pendingDeleteId = dialog.dataset.editId;
    const s = state.students.find(x=>x.id===pendingDeleteId);
    const name = s?.name || 'tego ucznia';
    const txt = el('confirmText'); if(txt) txt.textContent = `Na pewno chcesz usunąć "${name}"? Tej operacji nie można cofnąć.`;
    const cw = el('confirmWrap'); if(cw) cw.style.display='flex';
  });
  el('confirmCancel')?.addEventListener('click',()=>{ pendingDeleteId=null; const cw=el('confirmWrap'); if(cw) cw.style.display='none'; });
  el('confirmDelete')?.addEventListener('click',()=>{
    if(!pendingDeleteId) return;
    state.students = state.students.filter(x=>x.id!==pendingDeleteId);
    save(); pendingDeleteId=null;
    const cw=el('confirmWrap'); if(cw) cw.style.display='none';
    closeDialog(); setView('list'); currentId=null; renderList();
  });

  // Avatar upload UX
  el('avatarUpload')?.addEventListener('click',()=> el('sAvatar')?.click());
  el('avatarPick')?.addEventListener('click',(e)=>{ e.stopPropagation(); el('sAvatar')?.click(); });
  el('sAvatar')?.addEventListener('change', (e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const info=el('avatarInfo'); if(info){ info.textContent='wybrano'; info.dataset.dataurl=r.result; } updateAvatarPreviewFrom(el('sName')?.value, r.result); }; r.readAsDataURL(f); });

  el('confirmDialog')?.addEventListener('click',()=>{
    const name=el('sName')?.value.trim(); if(!name){ alert('Podaj imię i nazwisko'); return; }
    const place=el('sPlace')?.value.trim(); const notes=el('sNotes')?.value.trim();
    const pricing={ remote60:numOrNull(el('priceR60')?.value), remote90:numOrNull(el('priceR90')?.value), remote120:numOrNull(el('priceR120')?.value), station60:numOrNull(el('priceS60')?.value), station90:numOrNull(el('priceS90')?.value), station120:numOrNull(el('priceS120')?.value)};
    const avatar=el('avatarInfo')?.dataset.dataurl; const active={ type:el('activeType')?.value, dur:Number(el('activeDur')?.value) };

    if(dialog?.dataset.editId){
      const s=state.students.find(x=>x.id===dialog.dataset.editId); if(!s) return; s.name=name; s.place=place; s.notes=notes; s.pricing={...(s.pricing||{}),...pricing}; s.active=active; if(avatar) s.avatar=avatar; save(); if(currentId===s.id){ selectStudent(s.id);} }
    else { const order=(state.students.reduce((m,x)=>Math.max(m,x.order??-1),-1)+1); state.students.push({id:uid(), order, name, place, notes, balance:0, pricing, avatar, active}); save(); }
    closeDialog(); renderList();
  });
  function numOrNull(v){ const n=Number(v); return isNaN(n)? null:n; }

  el('plus10')?.addEventListener('click',()=>applyDelta(10));
  el('minus10')?.addEventListener('click',()=>applyDelta(-10));
  el('resetBtn')?.addEventListener('click',resetBalance);
  el('addPlus')?.addEventListener('click',()=>{ const v=Number(el('customAmount')?.value); if(!v) return; applyDelta(Math.abs(v)); el('customAmount') && (el('customAmount').value=''); });
  el('addMinus')?.addEventListener('click',()=>{ const v=Number(el('customAmount')?.value); if(!v) return; applyDelta(-Math.abs(v)); el('customAmount') && (el('customAmount').value=''); });

  // Export/Import handlers
  const exportFunc = ()=>{
    const exportData = {
      ...state,
      staticPlan: loadStaticPlan(),
      tempChanges: loadTempChanges(),
      exportVersion: 2
    };
    const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='tuttorly-data.json';
    a.click(); URL.revokeObjectURL(url);
  };
  const importFunc = (fileInputId)=>{ const fileInput=el(fileInputId); if(!fileInput) return; const file=fileInput.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result); if(!data||!Array.isArray(data.students)) throw new Error('Z?y format pliku'); state=normalizeState(data); if(data.staticPlan) localStorage.setItem(staticPlanKey, JSON.stringify(normalizePlan(data.staticPlan))); if(data.tempChanges) localStorage.setItem(tempChangesKey, JSON.stringify(normalizeTempChanges(data.tempChanges))); save(); renderList(); renderStats(); renderEarnings(); renderWeek(); renderMonthCalendar(); setView('list'); currentId=null; alert('Zaimportowano dane.'); closeSettingsDialog(); }catch(err){ alert('B??d importu: '+err.message);} }; reader.readAsText(file); fileInput.value=''; };
  
  el('exportBtn')?.addEventListener('click', exportFunc);
  el('settingsExportBtn')?.addEventListener('click', exportFunc);
  el('importFile')?.addEventListener('change', (e)=>importFunc('importFile'));
  el('settingsImportFile')?.addEventListener('change', (e)=>importFunc('settingsImportFile'));

  // Settings modal handlers
  function openSettingsDialog(){ el('settingsDialogWrap').style.display='flex'; }
  function closeSettingsDialog(){ el('settingsDialogWrap').style.display='none'; }
  
    // Support modal handlers
  function openSupportDialog(){ el('supportDialogWrap').style.display='flex'; }
  function closeSupportDialog(){ el('supportDialogWrap').style.display='none'; }
  
  el('supportBtn')?.addEventListener('click', openSupportDialog);
  el('supportCloseBtn')?.addEventListener('click', closeSupportDialog);
  el('supportDialogWrap')?.addEventListener('click', (e)=>{ if(e.target===el('supportDialogWrap')) closeSupportDialog(); });

  el('settingsBtn')?.addEventListener('click', openSettingsDialog);

  el('settingsCloseBtn')?.addEventListener('click', closeSettingsDialog);
  el('settingsDialogWrap')?.addEventListener('click', (e)=>{ if(e.target===el('settingsDialogWrap')) closeSettingsDialog(); });

  // Calendar button (placeholder for future functionality)
  el('calendarBtn')?.addEventListener('click', ()=>{ console.log('Calendar button clicked'); });

  el('toggleMapBtn')?.addEventListener('click', () => {
    const mapWrap = el('map').parentNode;
    const isHidden = mapWrap.style.display === 'none';
    mapWrap.style.display = isHidden ? 'block' : 'none';
    el('toggleMapBtn').textContent = isHidden ? 'Ukryj mapę' : 'Pokaż mapę';
  });

  // --- INCOME ENTRIES LOGIC ---
  let pendingIncomeDeleteId = null;
  let currentIncomeType = 'cash';
  let incomeSelectedStudentIds = [];
  let chartYear = new Date().getFullYear();
  
  function setTodayDate(){
    const today = new Date().toISOString().split('T')[0];
    el('incomeDate').value = today;
  }

  function updateIncomeTypeButtons(type){
    currentIncomeType = type;
    el('incomeType').value = type;
    document.querySelectorAll('.incomeTypeBtn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
  }
  function renderIncomeSelectedList(){
    const listEl = el('incomeSelectedList');
    if(!listEl) return;
    listEl.innerHTML = "";
    incomeSelectedStudentIds.forEach(id => {
      const name = getStudentDisplayNameById(id);
      if(!name) return;
      const chip = document.createElement('div');
      chip.className = 'selectedChip';
      chip.innerHTML = `<span>${escapeHtml(name)}</span><button type="button" aria-label="Usun">X</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        incomeSelectedStudentIds = incomeSelectedStudentIds.filter(x => x !== id);
        renderIncomeSelectedList();
      });
      listEl.appendChild(chip);
    });
  }
  function setIncomeSelectedIds(ids){
    incomeSelectedStudentIds = Array.from(new Set((ids || []).filter(Boolean)));
    renderIncomeSelectedList();
  }
  function setupIncomeStudentPicker(){
    const input = el('incomeStudentSearch');
    const listEl = el('incomeStudentSuggestions');
    if(!input || !listEl) return;
    const hide = ()=>{ listEl.style.display = 'none'; listEl.innerHTML = ''; };
    const render = ()=>{
      renderStudentSuggestions(listEl, input.value, incomeSelectedStudentIds);
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    listEl.addEventListener('mousedown', (e)=>{
      const item = e.target.closest('.studentPickerItem');
      if(!item) return;
      const id = item.dataset.id;
      if(id && !incomeSelectedStudentIds.includes(id)) incomeSelectedStudentIds.push(id);
      input.value = '';
      hide();
      renderIncomeSelectedList();
    });
    document.addEventListener('click', (e)=>{
      if(e.target === input) return;
      if(listEl.contains(e.target)) return;
      hide();
    });
  }

  function openIncomeDialog(editId){
    const incomeDialog = el('incomeDialogWrap');
    if(!incomeDialog) return;
    incomeDialog.style.display='flex';
    
    const title = el('incomeDialogTitle');
    const amount = el('incomeAmount');
    const date = el('incomeDate');
    const note = el('incomeNote');
    const search = el('incomeStudentSearch');
    const delBtn = el('incomeDeleteBtn');

    if(editId){
      const entry = state.earnings.find(e => e.id === editId);
      if(!entry) return;
      title && (title.textContent = 'Edytuj wpis dochodów');
      amount && (amount.value = entry.amount);
      updateIncomeTypeButtons(entry.type);
      date && (date.value = entry.date);
      setIncomeSelectedIds(entry.studentIds || []);
      note && (note.value = entry.noteText || '');
      search && (search.value = '');
      if(delBtn) delBtn.style.display = 'inline-flex';
      incomeDialog.dataset.editId = editId;
    } else {
      title && (title.textContent = 'Nowy wpis dochodów');
      amount && (amount.value = '');
      updateIncomeTypeButtons('cash');
      setIncomeSelectedIds([]);
      note && (note.value = '');
      search && (search.value = '');
      setTodayDate();
      if(delBtn) delBtn.style.display = 'none';
      delete incomeDialog.dataset.editId;
    }
    setTimeout(() => amount && amount.focus(), 50);
  }

  function renderStats(){
    const monthStr = el('monthDisplay')?.textContent || '';
    const [monthName, yearStr] = monthStr.split(' ');
    const monthMap = {'styczeń':1, 'luty':2, 'marzec':3, 'kwiecień':4, 'maj':5, 'czerwiec':6, 'lipiec':7, 'sierpień':8, 'wrzesień':9, 'październik':10, 'listopad':11, 'grudzień':12};
    const month = monthMap[monthName.toLowerCase()] || 10;
    const year = parseInt(yearStr) || 2025;
    
    // Monthly totals
    let total = 0, online = 0, cash = 0;
    
    // Annual totals
    let annualTotal = 0, annualOnline = 0, annualCash = 0;
    
    (state.earnings || []).forEach(entry => {
      const d = new Date(entry.date + 'T00:00:00');
      const entryYear = d.getFullYear();
      const entryMonth = d.getMonth() + 1;
      
      // Monthly calculation
      if(entryMonth === month && entryYear === year){
        total += entry.amount;
        if(entry.type === 'cash') cash += entry.amount;
        else online += entry.amount;
      }
      
      // Annual calculation (only for current year)
      if(entryYear === year){
        annualTotal += entry.amount;
        if(entry.type === 'cash') annualCash += entry.amount;
        else annualOnline += entry.amount;
      }
    });
    
    // Update monthly stats
    el('totalAmount').textContent = formatPLN(total);
    el('onlineAmount').textContent = formatPLN(online);
    el('cashAmount').textContent = formatPLN(cash);
    
    // Update annual stats
    el('annualTotal').textContent = formatPLN(annualTotal);
    el('annualOnline').textContent = formatPLN(annualOnline);
    el('annualCash').textContent = formatPLN(annualCash);
    
    // Update stat bars
    const onlineBar = el('onlineBar');
    const cashBar = el('cashBar');
    if(onlineBar) onlineBar.style.width = total > 0 ? (online / total * 100) + '%' : '0%';
    if(cashBar) cashBar.style.width = total > 0 ? (cash / total * 100) + '%' : '0%';
    
    // Draw chart for the entire selected year
    drawChart(year);
    renderOverduePayments();
  }



  function drawChart(year){
    const canvas = el('earningsChart');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const monthInv = {1:'sty', 2:'lut', 3:'mar', 4:'kwi', 5:'maj', 6:'cze', 7:'lip', 8:'sie', 9:'wrz', 10:'paź', 11:'lis', 12:'gru'};
    
    // Get 12 months data for the selected year
    const months12 = [];
    
    for(let m = 0; m < 12; m++){
      const d = new Date(year, m, 1);
      months12.push({month: d.getMonth() + 1, year: d.getFullYear()});
    }
    
    // Collect earnings by month and type
    const monthsData = {};
    months12.forEach(m => {
      monthsData[`${m.year}-${m.month}`] = {cash: 0, card: 0, total: 0};
    });
    
    (state.earnings || []).forEach(entry => {
      const d = new Date(entry.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if(monthsData[key]){
        const type = entry.type === 'cash' ? 'cash' : 'card';
        monthsData[key][type] += entry.amount;
        monthsData[key].total += entry.amount;
      }
    });
    
    const maxVal = Math.max(...Object.values(monthsData).map(m => m.total), 1);
    
    // Padding and dimensions - different for each side
    const padLeft = 50;
    const padRight = 20;
    const padTop = 28;
    const padBottom = 28;
    const w = canvas.width - padLeft - padRight;
    const h = canvas.height - padTop - padBottom;
    const barWidth = w / 12;
    
    // Colors
    const colors = {cash: '#22c55e', card: '#5dd7ef'};
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '10px system-ui';
    ctx.fillStyle = 'rgba(154, 163, 173, 0.7)';
    
    // Y-axis labels and grid
    for(let i = 0; i <= 5; i++){
      const val = (maxVal / 5) * i;
      const y = padTop + h - (i / 5) * h;
      ctx.fillText(val.toFixed(0) + ' zł', 3, y + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(canvas.width - padRight, y);
      ctx.stroke();
    }
    
    // Draw bars
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();
    
    months12.forEach((m, idx) => {
      const key = `${m.year}-${m.month}`;
      const data = monthsData[key];
      const x = padLeft + idx * barWidth + barWidth * 0.15;
      const barH = barWidth * 0.7;
      
      let stackY = 0;
      
      ['cash', 'card'].forEach(type => {
        const amount = data[type];
        const barHeight = (amount / maxVal) * h;
        const barY = padTop + h - stackY - barHeight;
        
        ctx.fillStyle = colors[type];
        ctx.fillRect(x, barY, barH, barHeight);
        
        stackY += barHeight;
      });
      
      // Month label - centered under bar area
      ctx.fillStyle = 'rgba(154, 163, 173, 0.75)';
      ctx.font = '10px system-ui';
      const label = monthInv[m.month];
      const labelX = padLeft + (idx + 0.5) * barWidth;
      ctx.textAlign = 'center';
      ctx.fillText(label, labelX, canvas.height - 10);
    });
    
    // Legend - at top
    const legendY = 12;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(padLeft, legendY, 6, 6);
    ctx.fillStyle = 'rgba(154, 163, 173, 0.9)';
    ctx.fillText('Stacjonarnie', padLeft + 9, legendY + 5);
    
    ctx.fillStyle = '#5dd7ef';
    ctx.fillRect(padLeft + 110, legendY, 6, 6);
    ctx.fillStyle = 'rgba(154, 163, 173, 0.9)';
    ctx.fillText('Online', padLeft + 119, legendY + 5);
  }

  function renderEarnings(){
    const list = el('earningsList');
    if(!list) return;
    list.innerHTML = '';
    
    if(!state.earnings || state.earnings.length === 0){
      list.innerHTML = `<div class="emptyState">Brak wpisów dochodów.<br>Kliknij + aby dodać.</div>`;
      return;
    }

    // Display all earnings sorted by date (without month filtering)
    const sorted = state.earnings.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = entry.id;
      const typeLabel = entry.type === 'cash' ? '💵' : '🌐';
      const dateObj = new Date(entry.date + 'T00:00:00');
      const dateStr = dateObj.toLocaleDateString('pl-PL', {year:'numeric', month:'short', day:'numeric'});
      const desc = getEarningDescription(entry);
      
      card.innerHTML = `
        <div style="flex:1">
          <div class="name">${formatPLN(entry.amount)} <span style="font-size:12px; color:var(--muted)">${typeLabel}</span></div>
          <div class="sub">${dateStr}${desc ? ' · ' + escapeHtml(desc) : ''}</div>
        </div>`;
      
      card.addEventListener('click', () => {
        openIncomeDialog(entry.id);
      });
      
      list.appendChild(card);
    });
  }

  const incomeDialog = el('incomeDialogWrap');
  setupIncomeStudentPicker();
  
  // Handle income type button clicks
  document.querySelectorAll('.incomeTypeBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.dataset.type;
      updateIncomeTypeButtons(type);
    });
  });
  
  el('incomeCancelBtn')?.addEventListener('click', () => closeIncomeDialog());
  
  el('incomeConfirmBtn')?.addEventListener('click', () => {
    const amount = Number(el('incomeAmount')?.value);
    const type = el('incomeType')?.value || 'online';
    const date = el('incomeDate')?.value;
    const noteText = (el('incomeNote')?.value || '').trim();
    const searchText = (el('incomeStudentSearch')?.value || '').trim();
    let extraNote = [noteText, searchText].filter(Boolean).join(', ');
    const studentIds = incomeSelectedStudentIds.slice();
    if(studentIds.length && extraNote){
      const names = studentIds.map(getStudentDisplayNameById).filter(Boolean);
      const extraNorm = normalizeText(extraNote);
      const joinedNorm = normalizeText(names.join(', '));
      const matchSingle = names.some(n => normalizeText(n) === extraNorm);
      if(matchSingle || extraNorm === joinedNorm) extraNote = '';
    }
    const description = getEarningDescription({ studentIds, noteText: extraNote });

    if(!amount || amount <= 0){
      alert('Podaj kwotę większą niż 0');
      return;
    }
    if(!date){
      alert('Podaj datę');
      return;
    }

    if(incomeDialog?.dataset.editId){
      const entry = state.earnings.find(e => e.id === incomeDialog.dataset.editId);
      if(!entry) return;
      entry.amount = amount;
      entry.type = type;
      entry.date = date;
      entry.studentIds = studentIds;
      entry.noteText = extraNote;
      entry.description = description;
    } else {
      state.earnings.push({
        id: uid(),
        amount,
        type,
        date,
        description: description,
        studentIds,
        noteText: extraNote,
        createdAt: new Date().toISOString()
      });
    }

    save();
    closeIncomeDialog();
    renderStats();
    renderEarnings();
  });

  el('incomeDeleteBtn')?.addEventListener('click', () => {
    if(!incomeDialog?.dataset.editId) return;
    pendingIncomeDeleteId = incomeDialog.dataset.editId;
    const entry = state.earnings.find(e => e.id === pendingIncomeDeleteId);
    const txt = `Na pewno chcesz usunąć wpis ${formatPLN(entry?.amount || 0)}? Tej operacji nie można cofnąć.`;
    if(confirm(txt)){
      state.earnings = state.earnings.filter(e => e.id !== pendingIncomeDeleteId);
      save();
      closeIncomeDialog();
      renderStats();
      renderEarnings();
    }
    pendingIncomeDeleteId = null;
  });

  // Prevent text selection and copying (except in input/textarea)
  document.addEventListener('copy', (e) => {
    if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA'){
      e.preventDefault();
    }
  });

  renderList();
  setView('list');
  updateMap('Polska');

  // (Optional) seed history when supported (no-op in sandbox)
  safeReplace(location.pathname + location.search, {screen:'list'});

  // ===== MOBILE BACK BUTTON HANDLING =====
  // Track view history for back button behavior
  let viewHistory = ['list'];
  let detailHistory = []; // Track which student detail views were opened

  // Override switchTab to update history
  const originalSwitchTab = switchTab;
  switchTab = function(tabName){
    originalSwitchTab(tabName);
    // Only add to history if different from last view
    if(viewHistory[viewHistory.length - 1] !== tabName){
      viewHistory.push(tabName);
      safePush(location.pathname + location.search, {screen: tabName});
    }
  };

  // Override setView to track detail view history
  const originalSetView = setView;
  setView = function(which){
    originalSetView(which);
    if(which === 'detail' && currentId){
      detailHistory.push(currentId);
    } else if(which === 'list'){
      detailHistory = [];
    }
  };

  // Handle browser back button and system back button
  function handleBackButton(){
    // Priority 1: Close day popup from calendar
    const dayPopups = document.querySelectorAll('.dialog-wrap');
    if(dayPopups.length > 0){
      dayPopups[dayPopups.length - 1].remove();
      return;
    }

    // Priority 1.5: Close calendar/schedule edit popups
    if(el('tempChangePlanWrap') && el('tempChangePlanWrap').style.display === 'flex'){
      el('tempChangePlanWrap').style.display = 'none';
      tempChangeFromDayPopup = false;
      return;
    }
    if(el('planEditWrap') && el('planEditWrap').style.display === 'flex'){
      el('planEditWrap').style.display = 'none';
      return;
    }

    // Priority 2: Close any open dialogs/modals
    if(el('supportDialogWrap') && el('supportDialogWrap').style.display === 'flex'){
      closeSupportDialog();
      return;
    }
    if(el('settingsDialogWrap') && el('settingsDialogWrap').style.display === 'flex'){
      closeSettingsDialog();
      return;
    }
    if(dialog && dialog.style.display === 'flex'){
      closeDialog();
      return;
    }
    if(el('incomeDialogWrap') && el('incomeDialogWrap').style.display === 'flex'){
      closeIncomeDialog();
      return;
    }
    if(el('monthSelectorWrap') && el('monthSelectorWrap').style.display === 'flex'){
      closeMonthSelector();
      return;
    }
    if(el('yearSelectorWrap') && el('yearSelectorWrap').style.display === 'flex'){
      closeYearSelector();
      return;
    }

    // Priority 3: If in detail view, go back to list
    if(el('detailView') && el('detailView').style.display === 'flex'){
      setView('list');
      currentId = null;
      detailHistory = [];
      return;
    }

    // Priority 4: If in stats tab, go back to students
    if(currentView === 'stats'){
      switchTab('students');
      return;
    }

    // Priority 5: In students view - browser back button works normally
    // (allow normal back navigation or exit)
  }

  // Listen for popstate (browser back button, history changes)
  window.addEventListener('popstate', (e)=>{
    handleBackButton();
  });

  // For Android back button when not in PWA mode
  // Some browsers fire beforeunload, but we'll handle it with popstate
  // For PWA standalone mode, the system handles it via history
  
  // Optional: Add support for keyboard Escape key as back
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      handleBackButton();
    }
  });

  // Register Service Worker for installability & offline
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swScope='/Tuttorly-Lite/';
      try{ navigator.serviceWorker.register(swScope + 'sw.js', { scope: swScope }); }catch(e){}
    });
  }

  // --- Add to Home Screen (A2HS) banner ---
  (function(){
    let deferredPrompt=null;
    const BAR = ()=>document.getElementById('installBar');
    const BTN = ()=>document.getElementById('installBtn');
    const TXT = ()=>document.getElementById('installText');
    const CLOSEI = ()=>document.getElementById('installClose');
    const isStandalone=()=> window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isMobile=()=> /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    function showBarAndroid(){ const bar=BAR(), txt=TXT(), btn=BTN(); if(!bar || localStorage.getItem('a2hs.dismissed')==='1') return; if(isStandalone()) return; bar.style.display='flex'; if(txt) txt.textContent='Zainstaluj Tuttorly na ekranie głównym.'; if(btn) btn.style.display='inline-block'; }
    function showBarIOS(){ const bar=BAR(), txt=TXT(), btn=BTN(); if(!bar || localStorage.getItem('a2hs.dismissed')==='1') return; if(isStandalone()) return; bar.style.display='flex'; if(txt) txt.textContent='Na iOS: Udostępnij → „Do ekranu głównego”.'; if(btn) btn.style.display='none'; }

    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; if(isMobile()) showBarAndroid(); });
    BTN()?.addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); const choice=await deferredPrompt.userChoice; deferredPrompt=null; const bar=BAR(); if(bar) bar.style.display='none'; if(choice && choice.outcome==='dismissed'){ localStorage.setItem('a2hs.dismissed','1'); }});
    CLOSEI()?.addEventListener('click', ()=>{ const bar=BAR(); if(bar) bar.style.display='none'; localStorage.setItem('a2hs.dismissed','1'); });
    window.addEventListener('appinstalled', ()=>{ const bar=BAR(); if(bar) bar.style.display='none'; localStorage.removeItem('a2hs.dismissed'); });
    window.addEventListener('load', ()=>{ const isiOS=/iPhone|iPad|iPod/i.test(navigator.userAgent); if(isiOS && isMobile() && !isStandalone()) showBarIOS(); });
  })();

  // ===== TERMINY VIEW =====
  const staticPlanKey = 'tuttorly.staticPlan';
  const tempChangesKey = 'tuttorly.tempChanges';

  function normalizeLesson(lesson){
    const l = lesson || {};
    const next = { ...l };
    if(typeof next.studentId !== 'string') next.studentId = null;
    if(typeof next.customName !== 'string' || !next.customName){
      if(typeof next.student === 'string' && next.student.trim()) next.customName = next.student;
      else next.customName = '';
    }
    return next;
  }
  function normalizePlan(plan){
    return (plan || []).map(day => ({
      ...day,
      lessons: (day.lessons || []).map(normalizeLesson)
    }));
  }
  function normalizeTempChanges(changes){
    return (changes || []).map(tc => ({
      ...tc,
      lessons: (tc.lessons || []).map(normalizeLesson)
    }));
  }

  // Default static plan data
  const defaultStaticPlan = [
    {
      day: 'Poniedziałek',
      dayNum: 1,
      lessons: [
        { id: 'p001', startTime: '15:45', endTime: '17:00', type: 'ZD', customName: 'Jakub', note: 'Englilanka' },
        { id: 'p002', startTime: '17:15', endTime: '18:30', type: 'ZD', customName: 'Natalia', note: 'Przyspieszony' }
      ]
    },
    { day: 'Wtorek', dayNum: 2, lessons: [] },
    { day: 'Środa', dayNum: 3, lessons: [] },
    {
      day: 'Czwartek',
      dayNum: 4,
      lessons: [
        { id: 'c001', startTime: '16:00', endTime: '17:30', type: 'ST', customName: 'Radek', note: 'Matematyka' },
        { id: 'c002', startTime: '17:45', endTime: '19:00', type: 'ST', customName: 'RADEK', note: '' }
      ]
    },
    {
      day: 'Piątek',
      dayNum: 5,
      lessons: [
        { id: 'f001', startTime: '15:00', endTime: '16:00', type: 'ST', customName: 'Ursuszek', note: 'Retorowana 4/6' },
        { id: 'f002', startTime: '16:30', endTime: '17:45', type: 'ST', customName: 'Cecylia', note: 'Przydzielana 33 Lila 4/13dasdasdasdasdasdasdasdasdasdasdasdsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss' },
        { id: 'f003', startTime: '17:45', endTime: '19:00', type: 'ZD', customName: 'Amelia', note: '' }
      ]
    },
    { day: 'Sobota', dayNum: 6, lessons: [] },
    {
      day: 'Niedziela',
      dayNum: 7,
      lessons: [
        { id: 'n001', startTime: '10:00', endTime: '11:30', type: 'ST', customName: 'Moda Alicja', note: '' }
      ]
    }
  ];

  function loadStaticPlan(){
    const stored = localStorage.getItem(staticPlanKey);
    if(stored){
      try{ return normalizePlan(JSON.parse(stored)); }catch{}
    }
    return normalizePlan(defaultStaticPlan);
  }

  function loadTempChanges(){
    const stored = localStorage.getItem(tempChangesKey);
    if(stored){
      try{ return normalizeTempChanges(JSON.parse(stored)); }catch{}
    }
    return [];
  }

  function getToday(){
    const today = new Date();
    return today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  }

  function getTodayFromMonday(){
    // Convert JS day (0=Sun) to Polish week (1=Mon)
    const jsDay = getToday();
    return jsDay === 0 ? 7 : jsDay; // Convert Sunday (0) to 7
  }

  function getWeekStart(date){
    const d = new Date(date);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0,0,0,0);
    return monday;
  }
  function getWeekEnd(weekStart){
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return sunday;
  }
  function formatDatePL(d){
    return d.toLocaleDateString('pl-PL', {day:'2-digit', month:'2-digit', year:'numeric'});
  }
  function isDateInRange(dateStr, start, end){
    const d = new Date(dateStr + 'T00:00:00');
    return d >= start && d <= end;
  }
  function getPaidStudentIdsForRange(start, end){
    const paid = new Set();
    (state.earnings || []).forEach(entry => {
      if(!entry?.date) return;
      if(!isDateInRange(entry.date, start, end)) return;
      (entry.studentIds || []).forEach(id => paid.add(id));
    });
    return paid;
  }
  const overdueDismissKey = 'tuttorly.overdueDismissed';
  function loadDismissedOverdues(){
    try{ return new Set(JSON.parse(localStorage.getItem(overdueDismissKey) || '[]')); }catch{ return new Set(); }
  }
  function saveDismissedOverdues(set){
    localStorage.setItem(overdueDismissKey, JSON.stringify(Array.from(set)));
  }
  function getDateStr(date){
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function getLessonsForDate(date){
    const staticPlan = loadStaticPlan();
    const tempChanges = loadTempChanges();
    const dayNum = date.getDay() === 0 ? 7 : date.getDay();
    const dateStr = getDateStr(date);
    const tempChange = tempChanges.find(tc => tc.date === dateStr);
    const planDay = staticPlan.find(d => d.dayNum === dayNum);
    return tempChange?.lessons || planDay?.lessons || [];
  }
  function getOverdueEntries(maxWeeks){
    const result = [];
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const weeksToCheck = maxWeeks || 8;
    for(let i = 1; i <= weeksToCheck; i++){
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() - i * 7);
      const weekEnd = getWeekEnd(weekStart);
      const studentIdsInWeek = new Set();
      for(let d = 0; d < 7; d++){
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        getLessonsForDate(day).forEach(lesson => {
          if(lesson.studentId) studentIdsInWeek.add(lesson.studentId);
        });
      }
      if(studentIdsInWeek.size === 0) continue;
      const paidSet = getPaidStudentIdsForRange(weekStart, weekEnd);
      studentIdsInWeek.forEach(id => {
        if(!paidSet.has(id)){
          result.push({
            studentId: id,
            rangeLabel: `${formatDatePL(weekStart)}–${formatDatePL(weekEnd)}`
          });
        }
      });
    }
    return result;
  }
  function renderOverduePayments(){
    const list = el('overdueList');
    const header = el('overdueHeader');
    if(!list || !header) return;
    const dismissed = loadDismissedOverdues();
    const entries = getOverdueEntries(3).filter(e => !dismissed.has(`${e.studentId}|${e.rangeLabel}`));
    if(entries.length === 0){
      list.style.display = 'none';
      header.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    header.style.display = 'flex';
    list.style.display = 'block';
    list.innerHTML = '';
    entries.forEach(item => {
      const name = getStudentDisplayNameById(item.studentId) || 'Uczeń';
      const card = document.createElement('div');
      card.className = 'overdueItem';
      card.innerHTML = `
        <div class="overdueText">${escapeHtml(name)} | ${item.rangeLabel} |</div>
        <button class="overdueDismiss" data-dismiss="${item.studentId}|${item.rangeLabel}">x</button>`;
      const dismissBtn = card.querySelector('button[data-dismiss]');
      dismissBtn?.addEventListener('click', () => {
        dismissed.add(`${item.studentId}|${item.rangeLabel}`);
        saveDismissedOverdues(dismissed);
        renderOverduePayments();
      });
      list.appendChild(card);
    });
  }

  function renderWeek(){
    const container = el('weekContainer');
    if(!container) return;
    
    const staticPlan = loadStaticPlan();
    const tempChanges = loadTempChanges();
    
    const now = new Date();
    const day = now.getDay();
    const monday = getWeekStart(now);
    const weekEnd = getWeekEnd(monday);
    const paidSet = getPaidStudentIdsForRange(monday, weekEnd);

    const todayDayNum = day === 0 ? 7 : day;
    
    container.innerHTML = '';

    staticPlan.forEach(dayData => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + (dayData.dayNum - 1));
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dayCard = document.createElement('div');
      dayCard.className = 'dayCard';
      if(dayData.dayNum === todayDayNum) dayCard.classList.add('today');
      if(dayData.lessons.length === 0) dayCard.classList.add('empty');

      // Find temp changes for this specific date in current week
      const tempChange = tempChanges.find(tc => tc.date === dateStr);

      const lessonsToShow = tempChange?.lessons || dayData.lessons;

      const dayHeader = document.createElement('div');
      dayHeader.className = 'dayHeader';
      if(dayData.dayNum === todayDayNum) dayHeader.classList.add('today');
      dayHeader.textContent = dayData.day.substring(0, 3).toUpperCase();
      dayCard.appendChild(dayHeader);

      const lessonsList = document.createElement('div');
      lessonsList.className = 'lessonsList';

      if(lessonsToShow.length === 0){
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'emptyLessonMsg';
        emptyMsg.textContent = 'Brak zajęć';
        lessonsList.appendChild(emptyMsg);
      } else {
        lessonsToShow.forEach(lesson => {
          const item = document.createElement('div');
          item.className = 'lessonItem';

          const displayName = getLessonDisplayName(lesson);
          const hasStudentId = !!lesson.studentId;
          const isPaid = hasStudentId && paidSet.has(lesson.studentId);
          let html = `<div><div class="lessonMetaRow">`;
          html += `<label class="lessonPaymentCheck"><input type="checkbox" disabled ${isPaid ? 'checked' : ''} /></label>`;
          html += `<div class="lessonTypeAndStudent">`;
          html += `<span class="lessonTime">${lesson.startTime} - ${lesson.endTime}</span>`;
          html += `<span class="lessonType ${lesson.type.toLowerCase()}">${lesson.type}</span>`;
          html += `<span class="lessonStudent">${escapeHtml(displayName)}</span>`;
          html += `</div>`;
          html += `</div></div>`;
          if(lesson.note) html += `<div class="lessonNote">${lesson.note}</div>`;

          item.innerHTML = html;
          lessonsList.appendChild(item);
        });
      }

      dayCard.appendChild(lessonsList);
      container.appendChild(dayCard);
    });
  }

  // ===== MONTHLY CALENDAR STATE =====
  let monthCalendarState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  };

  const MONTHS_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
  const DAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

  function renderMonthCalendar(){
    const year = monthCalendarState.year;
    const month = monthCalendarState.month;
    
    // Update title
    el('monthTitleCal').textContent = `${year} ${MONTHS_PL[month].substring(0, 3).toUpperCase()}`;
    
    const staticPlan = loadStaticPlan();
    const tempChanges = loadTempChanges();
    const monthGrid = el('monthGrid');
    monthGrid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon, etc.
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const startDate = firstDay === 0 ? 6 : firstDay - 1;
    
    let dayCounter = 1;
    let prevMonthDays = daysInPrevMonth - startDate + 1;
    let nextMonthDay = 1;
    
    for(let i = 0; i < 42; i++){
      let currentDate = null;
      let isCurrentMonth = false;
      let dayNum = 0;
      
      if(i < startDate){
        dayNum = prevMonthDays;
        prevMonthDays++;
      } else if(dayCounter <= daysInMonth){
        dayNum = dayCounter;
        isCurrentMonth = true;
        currentDate = new Date(year, month, dayCounter);
        dayCounter++;
      } else {
        dayNum = nextMonthDay;
        nextMonthDay++;
      }
      
      const cell = document.createElement('div');
      cell.className = 'dayCell';
      if(!isCurrentMonth) cell.classList.add('otherMonth');
      
      if(isCurrentMonth){
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        
        // Check if this is today
        const today = new Date();
        if(currentDate.toDateString() === today.toDateString()){
          cell.classList.add('today');
        }
        
        // Check for temp changes
        const hasChange = tempChanges.some(tc => tc.date === dateStr);
        if(hasChange) cell.classList.add('hasChange');
        
        // Add click handler for current month days
        cell.addEventListener('click', () => showDayPopup(dateStr, dayNum, month, year));
      }
      
      const dayNumber = document.createElement('div');
      dayNumber.className = 'dayCellNumber';
      if(isCurrentMonth && currentDate.getDay() === 0) dayNumber.classList.add('weekend');
      if(isCurrentMonth && currentDate.getDay() === 6) dayNumber.classList.add('weekend');
      dayNumber.textContent = dayNum;
      cell.appendChild(dayNumber);
      
      // Add lesson indicators for current month
      if(isCurrentMonth){
        // Find the day of week for this date
        const jsDay = currentDate.getDay(); // 0=Sun, 1=Mon, etc.
        const dayOfWeek = jsDay === 0 ? 7 : jsDay;
        
        // Find corresponding static plan day
        const planDay = staticPlan.find(d => d.dayNum === dayOfWeek);
        
        // Check for temp changes
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const tempChange = tempChanges.find(tc => tc.date === dateStr);
        
        // Get actual lessons (temp changes take priority)
        const lessons = tempChange?.lessons || planDay?.lessons || [];
        
        if(lessons.length > 0){
          const indicators = document.createElement('div');
          indicators.className = 'dayCellIndicators';
          
          // Create single bar with color segments
          const bar = document.createElement('div');
          bar.className = 'lessonBar';
          
          // Build gradient with segments for each lesson
          const colors = [];
          const lessonCount = Math.min(lessons.length, 8);
          for(let j = 0; j < lessonCount; j++){
            const lesson = lessons[j];
            const color = lesson.type === 'ZD' ? 'var(--accent)' : 'var(--accent-2)';
            colors.push(color);
          }
          
          // Create linear gradient with equal segments and thin separator lines
          const separatorWidth = 2.5; // percentage points for separator
          const gradientStops = [];
          
          colors.forEach((color, i) => {
            const start = (i / colors.length) * 100;
            const end = ((i + 1) / colors.length) * 100;
            const adjustedEnd = end - (i < colors.length - 1 ? separatorWidth : 0);
            
            gradientStops.push(`${color} ${start}% ${adjustedEnd}%`);
            
            // Add separator line between segments (dark gray)
            if(i < colors.length - 1){
              gradientStops.push(`rgba(60,65,75,.9) ${adjustedEnd}% ${end}%`);
            }
          });
          
          bar.style.background = `linear-gradient(90deg, ${gradientStops.join(', ')})`;
          indicators.appendChild(bar);
          
          // Add "+X" badge if more lessons
          if(lessons.length > 8){
            const more = document.createElement('div');
            more.className = 'lessonMoreBadge';
            more.textContent = `+${lessons.length - 8}`;
            indicators.appendChild(more);
          }
          
          cell.appendChild(indicators);
        }
      }
      
      monthGrid.appendChild(cell);
    }
  }
  
  function showDayPopup(dateStr, dayNum, month, year){
    const date = new Date(year, month, dayNum);
    const staticPlan = loadStaticPlan();
    const tempChanges = loadTempChanges();
    
    // Find day of week
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    
    // Get plan for this day
    const planDay = staticPlan.find(d => d.dayNum === dayOfWeek);
    const tempChange = tempChanges.find(tc => tc.date === dateStr);
    const lessons = tempChange?.lessons || planDay?.lessons || [];
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'dialog-wrap';
    popup.style.display = 'flex';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    
    let html = `<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px">`;
    html += `<div><h3 style="margin:0 0 4px 0">${dayNames[jsDay]} ${dayNum} ${MONTHS_PL[month]}</h3>`;
    html += `<p style="color:var(--muted); font-size:12px; margin:0">${tempChange ? '⚙️ Zmiana tymczasowa' : 'Plan stały'}</p></div>`;
    if(tempChange){
      html += `<button class="btn ghost" style="position:relative; min-width:120px; padding:6px 12px; white-space:nowrap; flex-shrink:0" onclick="removeTempChange('${dateStr}'); this.closest('.dialog-wrap').remove()">↺ Przywróć</button>`;
    }
    html += `</div>`;
    
    if(lessons.length === 0){
      html += `<p style="color:var(--muted); text-align:center">Brak zajęć</p>`;
    } else {
      html += `<div style="display:flex; flex-direction:column; gap:8px">`;
      lessons.forEach(lesson => {
        const isZD = lesson.type === 'ZD';
        const badgeBg = isZD ? 'rgba(110,231,255,.25)' : 'rgba(139,92,246,.25)';
        const badgeColor = isZD ? '#6ee7ff' : '#b085f5';
        html += `<div style="background:#1a1e27; padding:8px; border-radius:8px; border:1px solid var(--border); font-size:12px">`;
        html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px">`;
        html += `<span style="color:var(--text); font-weight:700">${lesson.startTime}–${lesson.endTime}</span>`;
        html += `<span style="background:${badgeBg}; color:${badgeColor}; padding:1px 5px; border-radius:3px; font-size:10px; font-weight:700">${lesson.type}</span>`;
        html += `<span style="color:var(--text); font-weight:600">${escapeHtml(getLessonDisplayName(lesson))}</span>`;
        html += `</div>`;
        if(lesson.note) html += `<div style="color:var(--muted); font-size:11px; font-style:italic; word-break:break-word; word-wrap:break-word; overflow-wrap:break-word">${lesson.note}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }
    
    html += `<div class="footer" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap">`;
    html += `<button class="btn ghost" onclick="this.closest('.dialog-wrap').remove()">Zamknij</button>`;
    html += `<button class="btn primary" onclick="this.closest('.dialog-wrap').remove(); openTempChangeForDate('${dateStr}')">⚙ Zmiana</button>`;
    html += `</div>`;
    
    dialog.innerHTML = html;
    popup.appendChild(dialog);
    
    popup.addEventListener('click', (e) => {
      if(e.target === popup) popup.remove();
    });
    
    document.body.appendChild(popup);
  }
  
  function removeTempChange(dateStr){
    const tempChanges = loadTempChanges();
    const filtered = tempChanges.filter(tc => tc.date !== dateStr);
    localStorage.setItem(tempChangesKey, JSON.stringify(filtered));
    renderWeek();
    renderMonthCalendar();
  }
  
  function openTempChangeForDate(dateStr){
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    
    selectedTempChangeDate = new Date(year, month, day);
    tempChangeFromDayPopup = true;
    
    el('tempChangeStep1').style.display = 'none';
    el('tempChangeStep2').style.display = 'block';
    el('tempChangeSaveBtn').style.display = 'block';
    el('tempChangeCancelBtn').textContent = 'Zamknij';
    
    el('tempChangePlanWrap').style.display = 'flex';
    
    // Load and display the lessons for this day
    showTempChangeStep2(selectedTempChangeDate);
  }

  // ===== EDIT STATIC PLAN FUNCTIONS =====
  let selectedEditPlanDay = null;
  
  function openEditStaticPlanPopup(){
    const plan = loadStaticPlan();
    const selector = el('editPlanDaySelector');
    const today = getTodayFromMonday();
    if(!selector) return;
    
    selectedEditPlanDay = null;
    selector.innerHTML = '';
    el('editPlanStep1').style.display = 'block';
    el('editPlanStep2').style.display = 'none';
    el('editPlanCancel').style.display = 'block';
    el('editPlanBack').style.display = 'none';
    el('editPlanSave').style.display = 'none';
    
    plan.forEach(dayData => {
      const btn = document.createElement('button');
      btn.className = 'editPlanDayButton';
      if(dayData.dayNum === today) btn.classList.add('today');
      btn.innerHTML = `<div>${dayData.day}</div><div style="font-size:12px; color:var(--muted); margin-top:4px">${dayData.lessons.length} lekcji</div>`;
      btn.onclick = () => editStaticPlanStep2(dayData.dayNum);
      selector.appendChild(btn);
    });
    
    el('editPlanWrap').style.display = 'flex';
  }
  
  function editStaticPlanStep2(dayNum){
    const plan = loadStaticPlan();
    const dayData = plan.find(d => d.dayNum === dayNum);
    if(!dayData) return;
    
    selectedEditPlanDay = dayNum;
    const container = el('editPlanDayContainer');
    container.innerHTML = '';
    
    const col = document.createElement('div');
    col.className = 'dayColumn';
    col.innerHTML = `<h3>${dayData.day}</h3>`;
    
    const lessonsList = document.createElement('div');
    lessonsList.style.display = 'flex';
    lessonsList.style.flexDirection = 'column';
    lessonsList.style.gap = '8px';
    
    dayData.lessons.forEach(lesson => {
      const row = createLessonRowHTML(dayData.dayNum, lesson);
      lessonsList.appendChild(row);
    });
    
    // Add new lesson button
    const addBtn = document.createElement('button');
    addBtn.className = 'addLessonBtn';
    addBtn.textContent = '+ Dodaj lekcję';
    addBtn.onclick = () => {
      const newRow = createLessonRowHTML(dayNum, {id: uid(), startTime: '10:00', endTime: '11:00', type: 'ST', customName: '', note: ''});
      lessonsList.insertBefore(newRow, addBtn);
    };
    
    lessonsList.appendChild(addBtn);
    col.appendChild(lessonsList);
    container.appendChild(col);
    
    el('editPlanStep1').style.display = 'none';
    el('editPlanStep2').style.display = 'block';
    el('editPlanCancel').style.display = 'none';
    el('editPlanBack').style.display = 'block';
    el('editPlanSave').style.display = 'block';
  }
  
  function goBackToEditPlanStep1(){
    el('editPlanStep1').style.display = 'block';
    el('editPlanStep2').style.display = 'none';
    el('editPlanCancel').style.display = 'block';
    el('editPlanBack').style.display = 'none';
    el('editPlanSave').style.display = 'none';
    selectedEditPlanDay = null;
  }

  function createLessonRowHTML(dayNum, lesson){
    // Calculate duration in minutes from start and end time
    let duration = 60;
    if(lesson.startTime && lesson.endTime){
      const start = new Date(`2000-01-01T${lesson.startTime}`);
      const end = new Date(`2000-01-01T${lesson.endTime}`);
      duration = Math.round((end - start) / 60000);
    }
    
    const row = document.createElement('div');
    row.className = 'lessonRow';
    row.dataset.lessonId = lesson.id;
    row.dataset.dayNum = dayNum;
    row.dataset.studentId = lesson.studentId || '';
    
    row.innerHTML = `
      <div class="lessonRowTime">
        <input type="time" value="${lesson.startTime}" class="lessonStart" />
        <div class="durationButtonGroup" data-duration="${duration}">
          <button type="button" class="durationBtn ${duration === 60 ? 'active' : ''}" data-duration="60">60</button>
          <button type="button" class="durationBtn ${duration === 90 ? 'active' : ''}" data-duration="90">90</button>
          <button type="button" class="durationBtn ${duration === 120 ? 'active' : ''}" data-duration="120">120</button>
          <button type="button" class="durationBtn ${duration === 150 ? 'active' : ''}" data-duration="150">150</button>
          <button type="button" class="durationBtn ${duration === 180 ? 'active' : ''}" data-duration="180">180</button>
        </div>
      </div>
      <div class="lessonRowTypeStudent">
        <div class="typeButtonGroup">
          <button type="button" class="typeBtn st ${lesson.type === 'ST' ? 'active' : ''}" data-type="ST">ST</button>
          <button type="button" class="typeBtn zd ${lesson.type === 'ZD' ? 'active' : ''}" data-type="ZD">ZD</button>
        </div>
        <div class="studentPicker">
          <input type="text" class="lessonStudentInput studentPickerInput" value="${escapeHtml(getLessonDisplayName(lesson))}" placeholder="Imie" />
          <div class="studentPickerList"></div>
        </div>
      </div>
      <input type="text" class="lessonNoteInput" value="${lesson.note}" placeholder="Notatka" />
      <div class="lessonRowActions">
        <button type="button" class="deleteBtn">✕ Usuń lekcję</button>
      </div>
    `;
    
    // Setup type button handlers
    const stBtn = row.querySelector('.typeBtn.st');
    const zdBtn = row.querySelector('.typeBtn.zd');
    
    stBtn.addEventListener('click', () => {
      stBtn.classList.add('active');
      zdBtn.classList.remove('active');
    });
    
    zdBtn.addEventListener('click', () => {
      zdBtn.classList.add('active');
      stBtn.classList.remove('active');
    });
    
    // Setup duration button handlers
    const durationGroup = row.querySelector('.durationButtonGroup');
    const durationBtns = row.querySelectorAll('.durationBtn');
    
    durationBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        durationBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        durationGroup.dataset.duration = btn.dataset.duration;
      });
    });
    
    // Setup delete button
    row.querySelector('.deleteBtn').addEventListener('click', () => {
      row.remove();
    });
    
    const studentInput = row.querySelector('.lessonStudentInput');
    const studentList = row.querySelector('.studentPickerList');
    setupStudentPickerSingle(studentInput, studentList, (id)=>{ row.dataset.studentId = id || ''; });

    return row;
  }

  function saveEditStaticPlan(){
    if(!selectedEditPlanDay) return;
    
    const plan = loadStaticPlan();
    const dayData = plan.find(d => d.dayNum === selectedEditPlanDay);
    if(!dayData) return;
    
    const container = el('editPlanDayContainer');
    dayData.lessons = [];
    const rows = container.querySelectorAll('.lessonRow');
    
    rows.forEach(row => {
      const startTime = row.querySelector('.lessonStart').value;
      const duration = parseInt(row.querySelector('.durationButtonGroup').dataset.duration) || 60;
      const activeTypeBtn = row.querySelector('.typeBtn.active');
      const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'ST';
      const studentInput = row.querySelector('.lessonStudentInput').value.trim();
      const studentId = row.dataset.studentId || null;
      const customName = studentId ? '' : studentInput;
      const note = row.querySelector('.lessonNoteInput').value;
      
      if((studentId || customName) && startTime){
        // Calculate end time from start time + duration
        const start = new Date(`2000-01-01T${startTime}`);
        start.setMinutes(start.getMinutes() + duration);
        const endTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
        
        dayData.lessons.push({
          id: row.dataset.lessonId,
          startTime,
          endTime,
          type,
          studentId,
          customName,
          note
        });
      }
    });
    
    // Sort by time
    dayData.lessons.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    localStorage.setItem(staticPlanKey, JSON.stringify(plan));
    el('editPlanWrap').style.display = 'none';
    selectedEditPlanDay = null;
    renderWeek();
    renderMonthCalendar();
  }

  // Close edit plan popup
  el('editPlanCancel')?.addEventListener('click', () => {
    el('editPlanWrap').style.display = 'none';
    selectedEditPlanDay = null;
  });

  el('editPlanBack')?.addEventListener('click', goBackToEditPlanStep1);

  el('editPlanSave')?.addEventListener('click', () => {
    saveEditStaticPlan();
  });

  // ===== ADD TEMP CHANGE FUNCTIONS =====
  let selectedTempChangeDate = null;
  let calendarDisplayMonth = new Date().getMonth();
  let calendarDisplayYear = new Date().getFullYear();

  function renderTempChangeCalendar(year, month){
    const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    el('calendarMonth').textContent = monthNames[month];
    el('calendarYear').textContent = year;
    
    const container = el('miniCalendar');
    container.innerHTML = '';
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const offset = (firstDay.getDay() - 1 + 7) % 7;
    startDate.setDate(startDate.getDate() - offset);
    
    for(let i = 0; i < 42; i++){
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const btn = document.createElement('button');
      btn.textContent = date.getDate();
      
      if(date.getMonth() !== month) btn.classList.add('other-month');
      if(date.toDateString() === today.toDateString()) btn.classList.add('today');
      if(selectedTempChangeDate && date.toDateString() === selectedTempChangeDate.toDateString()) btn.classList.add('selected');
      
      btn.onclick = () => {
        selectedTempChangeDate = new Date(date);
        renderTempChangeCalendar(year, month);
        showTempChangeStep2(selectedTempChangeDate);
      };
      
      container.appendChild(btn);
    }
  }

  function openAddTempChangePopup(){
    selectedTempChangeDate = null;
    calendarDisplayMonth = new Date().getMonth();
    calendarDisplayYear = new Date().getFullYear();
    
    el('tempChangeStep1').style.display = 'block';
    el('tempChangeStep2').style.display = 'none';
    el('tempChangeSaveBtn').style.display = 'none';
    
    renderTempChangeCalendar(calendarDisplayYear, calendarDisplayMonth);
    el('tempChangePlanWrap').style.display = 'flex';
  }

  function showTempChangeStep2(date){
    const step1 = el('tempChangeStep1');
    const step2 = el('tempChangeStep2');
    const dayNum = date.getDay() === 0 ? 7 : date.getDay();
    const staticPlan = loadStaticPlan();
    const dayData = staticPlan.find(d => d.dayNum === dayNum);
    const tempChanges = loadTempChanges();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const existingChange = tempChanges.find(tc => tc.date === dateStr);
    
    const container = el('tempChangeDayContainer');
    container.innerHTML = '';
    
    if(!dayData) return;
    
    const col = document.createElement('div');
    col.className = 'dayColumn';
    col.innerHTML = `<h3>${dayData.day} (${dateStr})</h3>`;
    
    const lessonsList = document.createElement('div');
    lessonsList.style.display = 'flex';
    lessonsList.style.flexDirection = 'column';
    lessonsList.style.gap = '8px';
    
    const lessonsToEdit = existingChange?.lessons || dayData.lessons;
    lessonsToEdit.forEach(lesson => {
      const row = createLessonRowHTML(dayNum, lesson);
      lessonsList.appendChild(row);
    });
    
    const addBtn = document.createElement('button');
    addBtn.className = 'addLessonBtn';
    addBtn.textContent = '+ Dodaj lekcję';
    addBtn.onclick = () => {
      const newRow = createLessonRowHTML(dayNum, {id: uid(), startTime: '10:00', endTime: '11:00', type: 'ST', customName: '', note: ''});
      lessonsList.insertBefore(newRow, addBtn);
    };
    
    lessonsList.appendChild(addBtn);
    col.appendChild(lessonsList);
    container.appendChild(col);
    
    step1.style.display = 'none';
    step2.style.display = 'block';
    el('tempChangeSaveBtn').style.display = 'block';
    el('tempChangeCancelBtn').textContent = el('tempChangeCancelBtn').dataset.step2;
  }

  function backToTempChangeCalendar(){
    el('tempChangeStep1').style.display = 'block';
    el('tempChangeStep2').style.display = 'none';
    el('tempChangeSaveBtn').style.display = 'none';
    el('tempChangeCancelBtn').textContent = el('tempChangeCancelBtn').dataset.step1;
  }

  function saveTempChange(){
    if(!selectedTempChangeDate) return;
    
    const dayNum = selectedTempChangeDate.getDay() === 0 ? 7 : selectedTempChangeDate.getDay();
    const dateStr = `${selectedTempChangeDate.getFullYear()}-${String(selectedTempChangeDate.getMonth() + 1).padStart(2, '0')}-${String(selectedTempChangeDate.getDate()).padStart(2, '0')}`;
    const container = el('tempChangeDayContainer');
    
    const lessons = [];
    const rows = container.querySelectorAll('.lessonRow');
    
    rows.forEach(row => {
      const startTime = row.querySelector('.lessonStart').value;
      const duration = parseInt(row.querySelector('.durationButtonGroup').dataset.duration) || 60;
      const activeTypeBtn = row.querySelector('.typeBtn.active');
      const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'ST';
      const studentInput = row.querySelector('.lessonStudentInput').value.trim();
      const studentId = row.dataset.studentId || null;
      const customName = studentId ? '' : studentInput;
      const note = row.querySelector('.lessonNoteInput').value;
      
      if((studentId || customName) && startTime){
        // Calculate end time from start time + duration
        const start = new Date(`2000-01-01T${startTime}`);
        start.setMinutes(start.getMinutes() + duration);
        const endTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
        
        lessons.push({
          id: row.dataset.lessonId,
          startTime,
          endTime,
          type,
          studentId,
          customName,
          note
        });
      }
    });
    
    lessons.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    const tempChanges = loadTempChanges();
    const idx = tempChanges.findIndex(tc => tc.date === dateStr);
    
    if(idx >= 0) tempChanges[idx] = {date: dateStr, lessons};
    else tempChanges.push({date: dateStr, lessons});
    
    localStorage.setItem(tempChangesKey, JSON.stringify(tempChanges));
    el('tempChangePlanWrap').style.display = 'none';
    renderWeek();
    renderMonthCalendar();
  }

  el('tempChangeCancelBtn')?.addEventListener('click', () => {
    if(tempChangeFromDayPopup){
      // When opened from day popup, always close
      el('tempChangePlanWrap').style.display = 'none';
      tempChangeFromDayPopup = false;
    } else if(el('tempChangeStep2').style.display === 'block'){
      backToTempChangeCalendar();
    }else{
      el('tempChangePlanWrap').style.display = 'none';
    }
  });

  el('tempChangeSaveBtn')?.addEventListener('click', () => {
    saveTempChange();
  });

  el('prevMonthBtn')?.addEventListener('click', () => {
    calendarDisplayMonth--;
    if(calendarDisplayMonth < 0){
      calendarDisplayMonth = 11;
      calendarDisplayYear--;
    }
    renderTempChangeCalendar(calendarDisplayYear, calendarDisplayMonth);
  });

  el('nextMonthBtn')?.addEventListener('click', () => {
    calendarDisplayMonth++;
    if(calendarDisplayMonth > 11){
      calendarDisplayMonth = 0;
      calendarDisplayYear++;
    }
    renderTempChangeCalendar(calendarDisplayYear, calendarDisplayMonth);
  });

  // Close popups on background click
  el('editPlanWrap')?.addEventListener('click', (e) => {
    if(e.target === el('editPlanWrap')) el('editPlanWrap').style.display = 'none';
  });

  el('tempChangePlanWrap')?.addEventListener('click', (e) => {
    if(e.target === el('tempChangePlanWrap')) el('tempChangePlanWrap').style.display = 'none';
  });

  // Event listeners for buttons
  el('editStaticPlanBtn')?.addEventListener('click', openEditStaticPlanPopup);
  el('addTempChangeBtn')?.addEventListener('click', openAddTempChangePopup);

  // Monthly calendar navigation
  el('prevMonthCal')?.addEventListener('click', () => {
    monthCalendarState.month--;
    if(monthCalendarState.month < 0){
      monthCalendarState.month = 11;
      monthCalendarState.year--;
    }
    renderMonthCalendar();
  });

  el('nextMonthCal')?.addEventListener('click', () => {
    monthCalendarState.month++;
    if(monthCalendarState.month > 11){
      monthCalendarState.month = 0;
      monthCalendarState.year++;
    }
    renderMonthCalendar();
  });

  // Render week when switching to terminy tab
  el('terminyTab')?.addEventListener('click', ()=>{
    setTimeout(()=>{ renderWeek(); renderMonthCalendar(); }, 50);
  });

  // Initial render on load if terminy is visible
  if(currentView === 'students'){
    setTimeout(()=>{ renderWeek(); renderMonthCalendar(); }, 100);
  } else {
    // Render calendar on page load
    renderMonthCalendar();
  }
  
