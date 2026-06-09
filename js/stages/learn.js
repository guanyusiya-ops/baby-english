import { speak, speakSlow } from '../audio.js';
import { loadProgress, toggleMastered, toggleMasteredSentence, getSceneMasteredCount } from '../storage.js';
import { getLevelData, getDictData } from '../app.js';

let isFirstRender = true;
let scrollObserver = null;
let undoTimer = null;

const speakerSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

export async function renderLearn(container, params) {
  const level = params && params[0] || '3yo';
  const sceneId = params && params[1];
  if (!sceneId) { navigateTo(`level/${level}`); return; }

  const data = await getLevelData(level);
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene) { navigateTo(`level/${level}`); return; }

  isFirstRender = true;
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }
  render(container, level, scene);
}

function render(container, level, scene) {
  const savedScroll = isFirstRender ? 0 : window.scrollY;

  const openGroups = new Set();
  container.querySelectorAll('.learn-group').forEach(g => {
    const detail = g.querySelector('.mastered-section');
    if (detail && detail.open) openGroups.add(g.id);
  });

  const progress = loadProgress();
  const { mastered, total } = getSceneMasteredCount(scene);
  const animClass = isFirstRender ? 'fade-in' : '';
  isFirstRender = false;

  const groupTabs = scene.groups.map((g, i) => {
    const label = g.title.split(' ')[0];
    return `<button class="group-tab" data-group-idx="${i}">${label}</button>`;
  }).join('');

  container.innerHTML = `
    <div class="learn-page ${animClass}">
      <div class="page-header">
        <button class="btn-back" onclick="navigateTo('level/${level}')">←</button>
        <h2>${scene.icon} ${scene.nameCN}</h2>
        <span class="header-info">${mastered}/${total}</span>
      </div>

      <div class="group-tabs-wrap">
        <div class="group-tabs">${groupTabs}</div>
      </div>

      <div class="learn-content">
        ${scene.groups.map((g, i) => renderGroup(g, i, progress)).join('')}
      </div>
    </div>
  `;

  openGroups.forEach(id => {
    const detail = container.querySelector(`#${id} .mastered-section`);
    if (detail) detail.open = true;
  });

  bindEvents(container, level, scene);
  setupScrollObserver(container);

  if (savedScroll > 0) {
    window.scrollTo(0, savedScroll);
  }
}

function renderGroup(group, index, progress) {
  const unmastered = [];
  const mastered = [];

  for (const w of group.words) {
    if (progress.mastered.includes(w.en)) {
      mastered.push(w);
    } else {
      unmastered.push(w);
    }
  }

  const unmasteredSentences = [];
  const masteredSentences = [];
  for (const s of group.sentences) {
    if (progress.masteredSentences.includes(s.en)) {
      masteredSentences.push(s);
    } else {
      unmasteredSentences.push(s);
    }
  }

  return `
    <div class="learn-group" id="group-${index}">
      <div class="group-title" data-group-idx="${index}">${group.title}</div>

      <div class="word-list">
        ${unmastered.map(w => renderWordRow(w, false)).join('')}
      </div>

      ${unmasteredSentences.length > 0 ? `
        <div class="sentence-section">
          ${unmasteredSentences.map(s => renderSentenceRow(s, false)).join('')}
        </div>
      ` : ''}

      ${mastered.length > 0 || masteredSentences.length > 0 ? `
        <details class="mastered-section">
          <summary class="mastered-summary">已掌握 ${mastered.length + masteredSentences.length} 个</summary>
          <div class="word-list mastered-list">
            ${mastered.map(w => renderWordRow(w, true)).join('')}
            ${masteredSentences.map(s => renderSentenceRow(s, true)).join('')}
          </div>
        </details>
      ` : ''}
    </div>
  `;
}

function renderWordRow(w, isMastered) {
  const emojiPart = w.emoji ? `<span class="item-emoji">${w.emoji}</span>` : '';
  return `
    <div class="learn-row ${isMastered ? 'is-mastered' : ''}" data-type="word" data-en="${escapeAttr(w.en)}">
      <div class="row-left">
        <span class="row-en">${w.en}</span>
        <span class="row-cn">${w.cn}</span>
        ${emojiPart}
      </div>
      <div class="row-right">
        <button class="btn-speak" data-speak="${escapeAttr(w.en)}">${speakerSVG}</button>
        <button class="btn-master ${isMastered ? 'mastered' : ''}" data-word="${escapeAttr(w.en)}">${isMastered ? '✅' : '☐'}</button>
      </div>
    </div>
  `;
}

function renderSentenceRow(s, isMastered) {
  const clickableEn = tokenizeSentence(s.en);
  return `
    <div class="learn-row sentence-row ${isMastered ? 'is-mastered' : ''}" data-type="sentence" data-en="${escapeAttr(s.en)}">
      <div class="row-left">
        <span class="row-en">${clickableEn}</span>
        <span class="row-cn">${s.cn}</span>
      </div>
      <div class="row-right">
        <button class="btn-speak" data-speak="${escapeAttr(s.en)}">${speakerSVG}</button>
        <button class="btn-master-sentence ${isMastered ? 'mastered' : ''}" data-sentence="${escapeAttr(s.en)}">${isMastered ? '✅' : '☐'}</button>
      </div>
    </div>
  `;
}

function tokenizeSentence(text) {
  return text.replace(/([a-zA-Z''’-]+)/g, '<span class="clickable-word" data-word="$1">$1</span>');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function findWordInScene(scene, en) {
  const enLower = en.toLowerCase().trim();
  for (const group of scene.groups) {
    for (const w of group.words) {
      if (w.en === en) return w;
    }
  }
  for (const group of scene.groups) {
    for (const w of group.words) {
      if (w.en.toLowerCase().trim() === enLower) return w;
    }
  }
  const forms = getBaseforms(en);
  for (const group of scene.groups) {
    for (const w of group.words) {
      const wLower = w.en.toLowerCase();
      for (const form of forms) {
        if (wLower === form) return w;
      }
    }
  }
  return null;
}

async function findWordGlobal(en) {
  const forms = getBaseforms(en);
  const levels = ['3yo', '6yo', '12yo'];
  for (const level of levels) {
    try {
      const data = await getLevelData(level);
      for (const scene of data.scenes) {
        for (const group of scene.groups) {
          for (const w of group.words) {
            const wLower = w.en.toLowerCase();
            for (const form of forms) {
              if (wLower === form) return w;
            }
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

function findPhraseContaining(scene, word) {
  const wLower = word.toLowerCase();
  for (const group of scene.groups) {
    for (const w of group.words) {
      if (w.en.includes(' ') && w.en.toLowerCase().split(/\s+/).includes(wLower)) {
        return w;
      }
    }
  }
  return null;
}

async function findWordInDict(en) {
  try {
    const dict = await getDictData();
    const forms = getBaseforms(en);
    for (const w of dict) {
      const wLower = w.en.toLowerCase();
      if (wLower === en.toLowerCase()) return w;
      for (const form of forms) {
        if (wLower === form) return w;
      }
    }
  } catch (e) {}
  return null;
}

const IRREGULAR = {
  feet:'foot',children:'child',teeth:'tooth',mice:'mouse',men:'man',women:'woman',people:'person',
  went:'go',gone:'go',did:'do',done:'do',was:'be',were:'be',been:'be',
  had:'have',has:'have',ate:'eat',eaten:'eat',drank:'drink',drunk:'drink',
  ran:'run',came:'come',took:'take',taken:'take',gave:'give',given:'give',
  saw:'see',seen:'see',fell:'fall',fallen:'fall',broke:'break',broken:'break',
  said:'say',made:'make',found:'find',told:'tell',heard:'hear',
  knew:'know',known:'know',thought:'think',felt:'feel',left:'leave',
  kept:'keep',sent:'send',spent:'spend',built:'build',
  wrote:'write',written:'write',read:'read',sang:'sing',sung:'sing',
  swam:'swim',swum:'swim',sat:'sit',stood:'stand',
  won:'win',lost:'lose',chose:'choose',chosen:'choose',
  spoke:'speak',spoken:'speak',woke:'wake',woken:'wake',
  bit:'bite',bitten:'bite',hid:'hide',hidden:'hide',
  caught:'catch',taught:'teach',bought:'buy',brought:'bring',
  fought:'fight',held:'hold',slept:'sleep',met:'meet',
  paid:'pay',fed:'feed',led:'lead',understood:'understand',
  forgot:'forget',forgotten:'forget',froze:'freeze',frozen:'freeze',
  drew:'draw',drawn:'draw',grew:'grow',grown:'grow',threw:'throw',thrown:'throw',
  wore:'wear',worn:'wear',tore:'tear',torn:'tear',
  drove:'drive',driven:'drive',rode:'ride',ridden:'ride',
  rose:'rise',risen:'rise',shook:'shake',shaken:'shake',
  hung:'hang',dug:'dig',shut:'shut',cut:'cut',put:'put',hit:'hit',
  lay:'lie',lain:'lie',
  better:'good',best:'good',worse:'bad',worst:'bad',
  more:'much',most:'much',less:'little',least:'little',
  further:'far',farther:'far'
};

function getBaseforms(word) {
  const w = word.toLowerCase();
  const forms = [w];
  if (IRREGULAR[w]) forms.push(IRREGULAR[w]);
  if (w.endsWith("'s")) forms.push(w.slice(0, -2));
  if (w.endsWith("'re")) forms.push(w.slice(0, -3));
  if (w.endsWith("'ll")) forms.push(w.slice(0, -3));
  if (w.endsWith("'ve")) forms.push(w.slice(0, -3));
  if (w.endsWith("'m")) forms.push(w.slice(0, -2));
  if (w.endsWith("n't")) forms.push(w.slice(0, -3));
  if (w.endsWith("'d")) forms.push(w.slice(0, -2));
  if (w.endsWith('ies') && w.length > 4) forms.push(w.slice(0, -3) + 'y');
  if (w.endsWith('es') && w.length > 3) forms.push(w.slice(0, -2));
  if (w.endsWith('s') && w.length > 2 && !w.endsWith('ss')) forms.push(w.slice(0, -1));
  if (w.endsWith('ing') && w.length > 4) {
    const base = w.slice(0, -3);
    forms.push(base);
    forms.push(base + 'e');
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      forms.push(base.slice(0, -1));
    }
  }
  if (w.endsWith('ied') && w.length > 4) forms.push(w.slice(0, -3) + 'y');
  if (w.endsWith('ed') && w.length > 3) {
    const base = w.slice(0, -2);
    forms.push(base);
    forms.push(base + 'e');
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
      forms.push(base.slice(0, -1));
    }
  }
  if (w.endsWith('er') && w.length > 3) {
    forms.push(w.slice(0, -2));
    forms.push(w.slice(0, -2) + 'e');
  }
  if (w.endsWith('est') && w.length > 4) {
    forms.push(w.slice(0, -3));
    forms.push(w.slice(0, -3) + 'e');
  }
  if (w.endsWith('ly') && w.length > 3) forms.push(w.slice(0, -2));
  return forms;
}

function showWordDetail(word) {
  closeDetail();

  const overlay = document.createElement('div');
  overlay.className = 'word-detail-overlay';
  overlay.addEventListener('click', closeDetail);

  const sheet = document.createElement('div');
  sheet.className = 'word-detail-sheet';
  sheet.addEventListener('click', (e) => e.stopPropagation());

  const examples = word.examples || [];
  const synonyms = word.synonyms || [];
  const synonymDiff = word.synonymDiff || '';

  sheet.innerHTML = `
    <div class="sheet-handle" onclick=""></div>
    <div class="detail-header">
      ${word.emoji ? `<div class="detail-emoji">${word.emoji}</div>` : ''}
      <div class="detail-word">${word.en}</div>
      ${word.phonetic ? `<div class="detail-phonetic">${word.phonetic}</div>` : ''}
      ${word.pos ? `<div class="detail-pos">${word.pos}</div>` : ''}
      <div class="detail-cn">${word.cn}</div>
    </div>

    <div class="detail-play-btns">
      <button class="detail-play-btn" data-rate="slow">${speakerSVG} 慢速</button>
      <button class="detail-play-btn" data-rate="normal">${speakerSVG} 正常</button>
    </div>

    ${examples.length > 0 ? `
      <div class="detail-section-title">常用口语例句</div>
      ${examples.map(ex => `
        <div class="detail-example-row" data-speak="${escapeAttr(ex.en)}">
          <div class="detail-example-en">${ex.en}</div>
          <div class="detail-example-cn">${ex.cn}</div>
        </div>
      `).join('')}
    ` : ''}

    ${synonyms.length > 0 ? `
      <div class="detail-section-title">近义词</div>
      <div class="detail-synonyms">
        ${synonyms.map(s => `<span class="detail-synonym-tag" data-speak="${escapeAttr(s)}">${s}</span>`).join('')}
      </div>
      ${synonymDiff ? `<div class="detail-diff">${synonymDiff}</div>` : ''}
    ` : ''}
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  sheet.querySelector('.sheet-handle').addEventListener('click', closeDetail);

  sheet.querySelectorAll('.detail-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.rate === 'slow') {
        speakSlow(word.en);
      } else {
        speak(word.en, 0.85);
      }
    });
  });

  sheet.querySelectorAll('.detail-example-row').forEach(row => {
    row.addEventListener('click', () => {
      speak(row.dataset.speak, 0.8);
    });
  });

  sheet.querySelectorAll('.detail-synonym-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      speak(tag.dataset.speak, 0.85);
    });
  });
}

function closeDetail() {
  const overlay = document.querySelector('.word-detail-overlay');
  const sheet = document.querySelector('.word-detail-sheet');
  if (overlay) overlay.remove();
  if (sheet) sheet.remove();
}

function showUndoToast(message, undoFn) {
  const existing = document.querySelector('.undo-toast');
  if (existing) existing.remove();
  if (undoTimer) clearTimeout(undoTimer);

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `<span>${message}</span><button class="undo-btn">撤回</button>`;
  document.body.appendChild(toast);

  toast.querySelector('.undo-btn').addEventListener('click', () => {
    clearTimeout(undoTimer);
    toast.remove();
    undoFn();
  });

  undoTimer = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setupScrollObserver(container) {
  if (scrollObserver) scrollObserver.disconnect();

  const titles = container.querySelectorAll('.group-title[data-group-idx]');
  const tabs = container.querySelectorAll('.group-tab');
  if (titles.length === 0) return;

  // offset = page-header height + tabs-wrap height
  const headerH = container.querySelector('.page-header')?.offsetHeight || 66;
  const tabsH = container.querySelector('.group-tabs-wrap')?.offsetHeight || 42;
  const topOffset = headerH + tabsH + 8;

  scrollObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const idx = entry.target.dataset.groupIdx;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.groupIdx === idx));
        const activeTab = container.querySelector(`.group-tab[data-group-idx="${idx}"]`);
        if (activeTab) {
          activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }
  }, {
    rootMargin: `-${topOffset}px 0px -60% 0px`,
    threshold: 0
  });

  titles.forEach(t => scrollObserver.observe(t));

  // Highlight first tab initially
  if (tabs.length > 0) tabs[0].classList.add('active');
}

function bindEvents(container, level, scene) {
  // Tab anchor navigation
  container.querySelectorAll('.group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = tab.dataset.groupIdx;
      const target = container.querySelector(`#group-${idx}`);
      if (target) {
        const headerH = container.querySelector('.page-header')?.offsetHeight || 66;
        const tabsH = container.querySelector('.group-tabs-wrap')?.offsetHeight || 42;
        const y = target.getBoundingClientRect().top + window.scrollY - headerH - tabsH - 4;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  container.querySelectorAll('.learn-row[data-type="word"]').forEach(row => {
    row.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-speak') || e.target.closest('.btn-master')) return;
      const en = row.dataset.en.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      let word = findWordInScene(scene, en);
      if (!word) word = await findWordGlobal(en);
      if (!word) word = await findWordInDict(en);
      if (!word) {
        const cn = row.querySelector('.row-cn')?.textContent || '';
        const emoji = row.querySelector('.item-emoji')?.textContent || '';
        word = { en, cn, emoji: emoji || undefined };
      }
      showWordDetail(word);
    });
  });

  container.querySelectorAll('.clickable-word').forEach(span => {
    span.addEventListener('click', async (e) => {
      e.stopPropagation();
      const wordText = span.dataset.word;
      let word = findWordInScene(scene, wordText) || findWordInScene(scene, wordText.toLowerCase());
      if (!word) word = await findWordGlobal(wordText);
      if (!word) word = findPhraseContaining(scene, wordText);
      if (!word) word = await findWordInDict(wordText);
      if (!word) word = { en: wordText, cn: '' };
      showWordDetail(word);
    });
  });

  container.querySelectorAll('.learn-row[data-type="sentence"]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-speak') || e.target.closest('.btn-master-sentence')) return;
      if (e.target.classList.contains('clickable-word')) return;
      const text = row.dataset.en.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      speak(text, 0.8);
    });
  });

  container.querySelectorAll('.btn-speak').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.speak;
      speak(text, text.split(' ').length <= 2 ? 0.85 : 0.8);
    });
  });

  container.querySelectorAll('.btn-master').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = btn.dataset.word;
      const wasMastered = btn.classList.contains('mastered');
      toggleMastered(word);

      if (!wasMastered) {
        const row = btn.closest('.learn-row');
        if (row) {
          container.style.pointerEvents = 'none';
          row.classList.add('mastering');
          setTimeout(() => {
            render(container, level, scene);
            setTimeout(() => { container.style.pointerEvents = ''; }, 300);
          }, 300);
        } else {
          render(container, level, scene);
        }
      } else {
        render(container, level, scene);
      }

      showUndoToast(wasMastered ? `已取消掌握：${word}` : `已掌握：${word}`, () => {
        toggleMastered(word);
        render(container, level, scene);
      });
    });
  });

  container.querySelectorAll('.btn-master-sentence').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sentence = btn.dataset.sentence;
      const wasMastered = btn.classList.contains('mastered');
      toggleMasteredSentence(sentence);

      if (!wasMastered) {
        const row = btn.closest('.learn-row');
        if (row) {
          container.style.pointerEvents = 'none';
          row.classList.add('mastering');
          setTimeout(() => {
            render(container, level, scene);
            setTimeout(() => { container.style.pointerEvents = ''; }, 300);
          }, 300);
        } else {
          render(container, level, scene);
        }
      } else {
        render(container, level, scene);
      }

      const short = sentence.length > 20 ? sentence.slice(0, 20) + '...' : sentence;
      showUndoToast(wasMastered ? `已取消掌握` : `已掌握：${short}`, () => {
        toggleMasteredSentence(sentence);
        render(container, level, scene);
      });
    });
  });
}
