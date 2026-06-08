import { speak, speakSlow } from '../audio.js';
import { loadProgress, recordResult, getAllWordsInScene, unlockStage } from '../storage.js';
import { getVocabData } from '../app.js';

let exercises = [];
let currentExIndex = 0;
let results = [];
let answered = false;

export async function renderRecognize(container, params) {
  const data = await getVocabData();

  if (params && params[0]) {
    startExercises(container, data, params[0]);
  } else {
    renderSceneList(container, data);
  }
}

function renderSceneList(container, data) {
  const progress = loadProgress();

  container.innerHTML = `
    <div class="toddler-page fade-in">
      <div class="scene-header">
        <button class="btn-back" onclick="navigateTo('map')">←</button>
        <h2>🧒 Recognize</h2>
        <span class="scene-counter">辨认期</span>
      </div>
      <div style="padding: 16px 20px 8px; text-align: center;">
        <p style="color: var(--text-light); font-size: 14px;">
          选择一个场景，测试你的词汇辨认能力
        </p>
      </div>
      <div class="unit-list">
        ${data.scenes.map(s => {
          const sp = progress.recognize.sceneProgress[s.id];
          const score = sp ? `${sp.correct}/${sp.attempts}` : '';
          return `
            <div class="unit-card" onclick="navigateTo('recognize/${s.id}')">
              <div class="unit-icon">${s.icon}</div>
              <h4>${s.nameCN}</h4>
              <div class="unit-score">${score || 'Start →'}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function generateExercises(data, sceneId) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene) return [];

  const allWords = getAllWordsInScene(scene);
  if (allWords.length < 4) return [];

  const shuffled = [...allWords].sort(() => Math.random() - 0.5);
  const exerciseCount = Math.min(10, allWords.length);
  const exList = [];

  for (let i = 0; i < exerciseCount; i++) {
    const correctWord = shuffled[i % shuffled.length];
    const hasEmoji = !!correctWord.emoji;
    const distractors = allWords
      .filter(w => w.word !== correctWord.word && (!hasEmoji || !!w.emoji) === hasEmoji)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    if (distractors.length < 3) {
      const extra = allWords
        .filter(w => w.word !== correctWord.word && !distractors.includes(w))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3 - distractors.length);
      distractors.push(...extra);
    }

    const options = [...distractors.slice(0, 3), correctWord].sort(() => Math.random() - 0.5);
    const allHaveEmoji = options.every(o => !!o.emoji);
    const typeRoll = Math.random();

    if (!allHaveEmoji) {
      exList.push({
        type: 'listen_pick',
        instruction: '听声音，选出对应的词',
        correctWord,
        options
      });
    } else if (typeRoll < 0.4) {
      exList.push({
        type: 'listen_pick',
        instruction: '听声音，选出对应的词',
        correctWord,
        options
      });
    } else if (typeRoll < 0.7) {
      exList.push({
        type: 'emoji_pick_word',
        instruction: '看图标，选出正确的单词',
        correctWord,
        options
      });
    } else {
      exList.push({
        type: 'word_pick_emoji',
        instruction: '看单词，选出对应的图标',
        correctWord,
        options
      });
    }
  }

  return exList;
}

function startExercises(container, data, sceneId) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene) { renderSceneList(container, data); return; }

  exercises = generateExercises(data, sceneId);
  currentExIndex = 0;
  results = [];
  answered = false;

  renderExercise(container, data, scene);
}

function renderExercise(container, data, scene) {
  if (currentExIndex >= exercises.length) {
    renderResult(container, data, scene);
    return;
  }

  const ex = exercises[currentExIndex];
  answered = false;

  const dots = exercises.map((_, i) => {
    if (i < results.length) return `<div class="exercise-dot ${results[i] ? 'done' : 'wrong-dot'}"></div>`;
    if (i === currentExIndex) return `<div class="exercise-dot current"></div>`;
    return `<div class="exercise-dot"></div>`;
  }).join('');

  let promptHTML = '';
  let optionsHTML = '';

  if (ex.type === 'listen_pick') {
    promptHTML = `<button class="btn-listen" id="btn-listen-again">🔊</button>`;
    optionsHTML = ex.options.map(o => `
      <button class="option-btn" data-word="${o.word}">
        ${o.emoji ? `<span>${o.emoji}</span>` : ''}
        <span class="option-text">${o.word}</span>
      </button>
    `).join('');
  } else if (ex.type === 'emoji_pick_word') {
    promptHTML = `<div class="exercise-prompt">${ex.correctWord.emoji}</div>`;
    optionsHTML = ex.options.map(o => `
      <button class="option-btn" data-word="${o.word}">
        <span class="option-text" style="font-size: 18px; font-weight: 700;">${o.word}</span>
      </button>
    `).join('');
  } else {
    promptHTML = `<div class="exercise-prompt word-prompt">${ex.correctWord.word}</div>`;
    optionsHTML = ex.options.map(o => `
      <button class="option-btn" data-word="${o.word}">
        <span style="font-size: 36px;">${o.emoji}</span>
      </button>
    `).join('');
  }

  container.innerHTML = `
    <div class="toddler-page fade-in">
      <div class="scene-header">
        <button class="btn-back" id="btn-ex-back">←</button>
        <h2>${scene.icon} ${scene.nameCN}</h2>
        <span class="scene-counter">${currentExIndex + 1}/${exercises.length}</span>
      </div>
      <div class="exercise-area">
        <div class="exercise-progress">${dots}</div>
        <div class="exercise-instruction">${ex.instruction}</div>
        ${promptHTML}
        <div class="options-grid">${optionsHTML}</div>
        <div class="exercise-feedback" id="feedback"></div>
      </div>
    </div>
  `;

  container.querySelector('#btn-ex-back').addEventListener('click', () => navigateTo('recognize'));

  if (ex.type === 'listen_pick') {
    speakSlow(ex.correctWord.word);
    container.querySelector('#btn-listen-again').addEventListener('click', () => speakSlow(ex.correctWord.word));
  }

  container.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const selected = btn.dataset.word;
      const correct = selected === ex.correctWord.word;
      results.push(correct);
      recordResult('recognize', scene.id, correct);

      const feedback = container.querySelector('#feedback');

      if (correct) {
        btn.classList.add('correct');
        feedback.textContent = 'Correct! ✓';
        feedback.style.color = 'var(--success)';
      } else {
        btn.classList.add('wrong');
        feedback.textContent = `${ex.correctWord.emoji || ''} ${ex.correctWord.word}`;
        feedback.style.color = 'var(--error)';
        container.querySelectorAll('.option-btn').forEach(b => {
          if (b.dataset.word === ex.correctWord.word) b.classList.add('correct');
        });
      }
      feedback.classList.add('visible');
      speak(ex.correctWord.word);

      const progress = loadProgress();
      if (progress.recognize.totalAttempts >= 20) {
        unlockStage('sentences');
      }

      setTimeout(() => {
        currentExIndex++;
        renderExercise(container, data, scene);
      }, 1300);
    });
  });
}

function renderResult(container, data, scene) {
  const correct = results.filter(Boolean).length;
  const total = results.length;
  const pct = Math.round((correct / total) * 100);

  let icon, message;
  if (pct >= 80) { icon = '🌟'; message = 'Amazing!'; }
  else if (pct >= 60) { icon = '👏'; message = 'Good job!'; }
  else { icon = '💪'; message = 'Keep trying!'; }

  container.innerHTML = `
    <div class="toddler-page fade-in">
      <div class="scene-header">
        <button class="btn-back" onclick="navigateTo('recognize')">←</button>
        <h2>${scene.icon} ${scene.nameCN}</h2>
        <span class="scene-counter">Result</span>
      </div>
      <div class="exercise-result">
        <div class="result-icon">${icon}</div>
        <h3>${correct} / ${total}</h3>
        <p>${message}</p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
          <button class="btn-primary" id="btn-retry">再来一次</button>
          <button class="btn-secondary" onclick="navigateTo('recognize')">返回场景</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-retry').addEventListener('click', () => {
    startExercises(container, data, scene.id);
  });
}
