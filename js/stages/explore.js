import { speak, speakSlow } from '../audio.js';
import { markWordExplored, loadProgress, getAllWordsInScene, getExploreStats, unlockStage } from '../storage.js';
import { getVocabData } from '../app.js';

let phraseTimer = null;

export async function renderExplore(container, params) {
  const data = await getVocabData();
  const scenes = data.scenes;

  if (params && params[0]) {
    const scene = scenes.find(s => s.id === params[0]);
    if (scene) {
      renderScene(container, data, scene);
      return;
    }
  }

  renderSceneList(container, data);
}

function renderSceneList(container, data) {
  const progress = loadProgress();
  const stats = getExploreStats(data.scenes);

  container.innerHTML = `
    <div class="toddler-page fade-in">
      <div class="scene-header">
        <button class="btn-back" onclick="navigateTo('map')">←</button>
        <h2>👶 Explore</h2>
        <span class="scene-counter">${stats.totalExplored}/${stats.totalWords}</span>
      </div>
      <div style="padding: 16px 20px 8px; text-align: center;">
        <p style="color: var(--text-light); font-size: 14px;">
          选择一个场景，点击里面的词汇听发音
        </p>
        <div class="stage-progress-bar" style="margin-top: 8px;">
          <div class="stage-progress-fill" style="width: ${Math.round(stats.totalExplored / stats.totalWords * 100)}%"></div>
        </div>
      </div>
      <div class="unit-list" style="grid-template-columns: 1fr 1fr;">
        ${data.scenes.map(s => {
          const info = stats.perScene[s.id] || { explored: 0, total: 0 };
          const done = info.explored >= info.total;
          return `
            <div class="unit-card ${done ? 'unit-done' : ''}" onclick="navigateTo('explore/${s.id}')">
              <div class="unit-icon">${s.icon}</div>
              <h4>${s.nameCN}</h4>
              <div class="unit-score">${info.explored}/${info.total} ${done ? '✓' : ''}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

const CATEGORY_LABELS = {
  nouns: 'Things', verbs: 'Actions', adjectives: 'Describe',
  prepositions: 'Where', pronouns: 'Pronouns', questionWords: 'Questions',
  quantifiers: 'Quantity', helpingVerbs: 'Helpers', connectingWords: 'Linking'
};

function renderScene(container, data, scene) {
  const progress = loadProgress();
  const allWords = getAllWordsInScene(scene);
  const exploredWords = progress.explore.explored[scene.id] || [];

  const categories = [];
  for (const [key, items] of Object.entries(scene.words)) {
    if (Array.isArray(items) && items.length > 0) {
      categories.push({ key, label: CATEGORY_LABELS[key] || key, items });
    }
  }

  container.innerHTML = `
    <div class="scene-page fade-in" style="background: var(--bg-warm);">
      <div class="scene-header">
        <button class="btn-back" onclick="navigateTo('explore')">←</button>
        <h2>${scene.icon} ${scene.nameCN}</h2>
        <span class="scene-counter">${exploredWords.length}/${allWords.length}</span>
      </div>

      <div style="padding: 0 20px;">
        ${categories.map(cat => `
          <div class="word-category fade-in">
            <h3 class="category-title">${cat.label}</h3>
            <div class="word-grid">
              ${cat.items.map(item => `
                <div class="scene-item ${item.emoji ? '' : 'no-emoji'} ${exploredWords.includes(item.word) ? 'explored' : ''}"
                     data-word="${item.word}"
                     ${item.sound ? `data-sound="${item.sound}"` : ''}>
                  ${item.emoji
                    ? `<span class="emoji">${item.emoji}</span>`
                    : `<span class="text-icon">${item.word.charAt(0).toUpperCase()}</span>`}
                  <span class="word">${item.word}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      ${scene.sentences ? `
        <div style="padding: 0 20px 20px;">
          <div class="word-category">
            <h3 class="category-title">Sentences</h3>
            <div class="sentence-list">
              ${scene.sentences.map(s => `
                <div class="sentence-item" data-text="${s.text}">
                  <span class="sentence-level">L${s.level}</span>
                  <span class="sentence-text">${s.text}</span>
                  <span class="sentence-play">🔊</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="scene-phrase" id="scene-phrase"></div>
    </div>
  `;

  bindExploreEvents(container, data, scene);
}

function bindExploreEvents(container, data, scene) {
  container.querySelectorAll('.scene-item').forEach(item => {
    item.addEventListener('click', async () => {
      const word = item.dataset.word;
      const sound = item.dataset.sound;

      item.classList.add('speaking');
      item.classList.add('explored');
      item.querySelector('.word').style.opacity = '1';

      if (sound) {
        showPhrase(`${word} — "${sound}"`);
      } else {
        showPhrase(word);
      }

      await speakSlow(word);

      item.classList.remove('speaking');

      const progress = markWordExplored(scene.id, word);
      const allWords = getAllWordsInScene(scene);
      const exploredWords = progress.explore.explored[scene.id] || [];

      const counter = container.querySelector('.scene-counter');
      if (counter) counter.textContent = `${exploredWords.length}/${allWords.length}`;

      const stats = getExploreStats(data.scenes);
      if (stats.totalExplored >= Math.floor(stats.totalWords * 0.3)) {
        unlockStage('recognize');
      }
    });
  });

  container.querySelectorAll('.sentence-item').forEach(item => {
    item.addEventListener('click', async () => {
      const text = item.dataset.text;
      item.classList.add('speaking');
      showPhrase(text);
      await speak(text, 0.8);
      item.classList.remove('speaking');
    });
  });
}

function showPhrase(text) {
  const el = document.getElementById('scene-phrase');
  if (!el) return;
  clearTimeout(phraseTimer);
  el.textContent = text;
  el.classList.add('visible');
  phraseTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}
