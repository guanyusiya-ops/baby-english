import { speak, speakSlow } from '../audio.js';
import { loadProgress, toggleMastered, toggleMasteredSentence } from '../storage.js';
import { getLevelData } from '../app.js';

const speakerSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

export async function renderMastered(container) {
  const levels = ['3yo', '6yo', '12yo'];
  const allData = [];
  for (const level of levels) {
    try {
      const data = await getLevelData(level);
      allData.push(data);
    } catch (e) {}
  }
  render(container, allData);
}

function render(container, allData) {
  const progress = loadProgress();
  const masteredWords = progress.mastered;
  const masteredSentences = progress.masteredSentences;
  const total = masteredWords.length + masteredSentences.length;

  const sceneGroups = [];
  for (const data of allData) {
    for (const scene of data.scenes) {
      const words = [];
      const sentences = [];
      for (const group of scene.groups) {
        for (const w of group.words) {
          if (masteredWords.includes(w.en)) words.push(w);
        }
        for (const s of group.sentences) {
          if (masteredSentences.includes(s.en)) sentences.push(s);
        }
      }
      if (words.length > 0 || sentences.length > 0) {
        sceneGroups.push({ scene, words, sentences });
      }
    }
  }

  container.innerHTML = `
    <div class="mastered-page fade-in">
      <div class="page-header">
        <button class="btn-back" onclick="navigateTo('')">←</button>
        <h2>✅ 已掌握</h2>
        <span class="header-info">${total} 个</span>
      </div>

      ${total === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p>还没有标记任何词汇</p>
          <p class="empty-hint">在学习页面点击 ☐ 标记已掌握的词汇</p>
        </div>
      ` : `
        <div class="mastered-content">
          ${sceneGroups.map(({ scene, words, sentences }) => `
            <div class="mastered-scene-group">
              <div class="mastered-scene-title">${scene.icon} ${scene.nameCN}</div>
              <div class="word-list">
                ${words.map(w => `
                  <div class="learn-row" data-en="${escapeAttr(w.en)}">
                    <div class="row-left" data-speak="${escapeAttr(w.en)}">
                      <span class="row-en">${w.en}</span>
                      <span class="row-cn">${w.cn}</span>
                      ${w.emoji ? `<span class="item-emoji">${w.emoji}</span>` : ''}
                    </div>
                    <div class="row-right">
                      <button class="btn-speak" data-speak="${escapeAttr(w.en)}">${speakerSVG}</button>
                      <button class="btn-unmaster" data-word="${escapeAttr(w.en)}">↩️</button>
                    </div>
                  </div>
                `).join('')}
                ${sentences.map(s => `
                  <div class="learn-row sentence-row" data-en="${escapeAttr(s.en)}">
                    <div class="row-left" data-speak="${escapeAttr(s.en)}">
                      <span class="row-en">${s.en}</span>
                      <span class="row-cn">${s.cn}</span>
                    </div>
                    <div class="row-right">
                      <button class="btn-speak" data-speak="${escapeAttr(s.en)}">${speakerSVG}</button>
                      <button class="btn-unmaster-sentence" data-sentence="${escapeAttr(s.en)}">↩️</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  bindEvents(container, allData);
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function bindEvents(container, allData) {
  container.querySelectorAll('.btn-speak').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.speak;
      if (text.split(' ').length <= 2) {
        speakSlow(text);
      } else {
        speak(text, 0.8);
      }
    });
  });

  container.querySelectorAll('.row-left').forEach(el => {
    el.addEventListener('click', () => {
      const text = el.dataset.speak;
      if (text.split(' ').length <= 2) {
        speakSlow(text);
      } else {
        speak(text, 0.8);
      }
    });
  });

  container.querySelectorAll('.btn-unmaster').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMastered(btn.dataset.word);
      render(container, allData);
    });
  });

  container.querySelectorAll('.btn-unmaster-sentence').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMasteredSentence(btn.dataset.sentence);
      render(container, allData);
    });
  });
}
