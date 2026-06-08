import { speak } from '../audio.js';
import { loadProgress, recordResult } from '../storage.js';
import { getVocabData } from '../app.js';

let exercises = [];
let currentExIndex = 0;
let results = [];
let answered = false;

export async function renderSentences(container, params) {
  const data = await getVocabData();

  if (params && params[0]) {
    startExercises(container, data, params[0]);
  } else {
    renderSceneList(container, data);
  }
}

function renderSceneList(container, data) {
  const progress = loadProgress();
  const scenesWithSentences = data.scenes.filter(s => s.sentences && s.sentences.length > 0);

  container.innerHTML = `
    <div class="toddler-page fade-in">
      <div class="scene-header">
        <button class="btn-back" onclick="navigateTo('map')">←</button>
        <h2>👧 Sentences</h2>
        <span class="scene-counter">表达期</span>
      </div>
      <div style="padding: 16px 20px 8px; text-align: center;">
        <p style="color: var(--text-light); font-size: 14px;">
          选择一个场景，学习真实的英语句子
        </p>
      </div>
      <div class="unit-list">
        ${scenesWithSentences.map(s => {
          const sp = progress.sentences.sceneProgress[s.id];
          const score = sp ? `${sp.correct}/${sp.attempts}` : '';
          return `
            <div class="unit-card" onclick="navigateTo('sentences/${s.id}')">
              <div class="unit-icon">${s.icon}</div>
              <h4>${s.nameCN}</h4>
              <div class="unit-score">${score || `${s.sentences.length}句 →`}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function generateExercises(data, sceneId) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene || !scene.sentences) return [];

  const allSentences = [...scene.sentences].sort(() => Math.random() - 0.5);
  const exerciseCount = Math.min(10, allSentences.length);
  const exList = [];

  for (let i = 0; i < exerciseCount; i++) {
    const sentence = allSentences[i];
    const typeRoll = Math.random();

    if (typeRoll < 0.4) {
      const words = sentence.text.replace(/[!?.,]/g, '').split(' ');
      if (words.length >= 2) {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        let attempts = 0;
        while (shuffled.join(' ') === words.join(' ') && attempts < 5) {
          shuffled.sort(() => Math.random() - 0.5);
          attempts++;
        }
        exList.push({
          type: 'word_order',
          instruction: '听句子，把单词排列成正确的顺序',
          sentence,
          words,
          shuffledWords: shuffled
        });
        continue;
      }
    }

    if (typeRoll < 0.7) {
      const words = sentence.text.replace(/[!?.,]/g, '').split(' ');
      if (words.length >= 2) {
        const blankIdx = Math.floor(Math.random() * words.length);
        const blankWord = words[blankIdx];
        const allWords = getAllUniqueWords(data, sceneId);
        const distractors = allWords
          .filter(w => w !== blankWord)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        if (distractors.length >= 2) {
          const options = [...distractors.slice(0, 3), blankWord].sort(() => Math.random() - 0.5);
          exList.push({
            type: 'fill_blank',
            instruction: '选择正确的单词填入空格',
            sentence,
            words,
            blankIdx,
            blankWord,
            options
          });
          continue;
        }
      }
    }

    const otherSentences = allSentences
      .filter(s => s.text !== sentence.text)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    if (otherSentences.length >= 2) {
      const options = [...otherSentences.slice(0, 3), sentence].sort(() => Math.random() - 0.5);
      exList.push({
        type: 'listen_pick_sentence',
        instruction: '听句子，选出你听到的',
        sentence,
        options
      });
    }
  }

  return exList;
}

function getAllUniqueWords(data, sceneId) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene || !scene.sentences) return [];
  const wordSet = new Set();
  scene.sentences.forEach(s => {
    s.text.replace(/[!?.,]/g, '').split(' ').forEach(w => wordSet.add(w));
  });
  return [...wordSet];
}

function startExercises(container, data, sceneId) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene) { renderSceneList(container, data); return; }

  exercises = generateExercises(data, sceneId);
  if (exercises.length === 0) { renderSceneList(container, data); return; }
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

  let bodyHTML = '';

  if (ex.type === 'word_order') {
    bodyHTML = `
      <button class="btn-listen" id="btn-listen-again">🔊</button>
      <div class="word-order-answer" id="answer-area"></div>
      <div class="word-order-pool" id="word-pool">
        ${ex.shuffledWords.map((w, i) => `
          <button class="word-chip" data-word="${w}" data-idx="${i}">${w}</button>
        `).join('')}
      </div>
      <button class="btn-secondary" id="btn-check" style="margin-top: 16px; display: none;">Check ✓</button>
    `;
  } else if (ex.type === 'fill_blank') {
    const display = ex.words.map((w, i) => i === ex.blankIdx ? '<span class="blank-slot">____</span>' : w).join(' ');
    bodyHTML = `
      <button class="btn-listen" id="btn-listen-again">🔊</button>
      <div class="exercise-prompt word-prompt" style="font-size: 20px;">${display}</div>
      <div class="options-grid" style="grid-template-columns: 1fr 1fr;">
        ${ex.options.map(o => `
          <button class="option-btn" data-word="${o}">
            <span class="option-text" style="font-size: 18px; font-weight: 700;">${o}</span>
          </button>
        `).join('')}
      </div>
    `;
  } else {
    bodyHTML = `
      <button class="btn-listen" id="btn-listen-again">🔊</button>
      <div class="options-grid" style="grid-template-columns: 1fr;">
        ${ex.options.map(o => `
          <button class="option-btn sentence-option" data-text="${o.text}">
            <span class="option-text" style="font-size: 16px; font-weight: 600;">${o.text}</span>
          </button>
        `).join('')}
      </div>
    `;
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
        ${bodyHTML}
        <div class="exercise-feedback" id="feedback"></div>
      </div>
    </div>
  `;

  container.querySelector('#btn-ex-back').addEventListener('click', () => navigateTo('sentences'));

  const listenBtn = container.querySelector('#btn-listen-again');
  if (listenBtn) {
    speak(ex.sentence.text, 0.8);
    listenBtn.addEventListener('click', () => speak(ex.sentence.text, 0.8));
  }

  if (ex.type === 'word_order') {
    bindWordOrderEvents(container, data, scene, ex);
  } else if (ex.type === 'fill_blank') {
    bindFillBlankEvents(container, data, scene, ex);
  } else {
    bindSentencePickEvents(container, data, scene, ex);
  }
}

function bindWordOrderEvents(container, data, scene, ex) {
  const answerArea = container.querySelector('#answer-area');
  const pool = container.querySelector('#word-pool');
  const checkBtn = container.querySelector('#btn-check');
  const selected = [];

  pool.querySelectorAll('.word-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (answered) return;
      chip.classList.add('used');
      chip.style.visibility = 'hidden';
      selected.push({ word: chip.dataset.word, idx: chip.dataset.idx, el: chip });

      const tag = document.createElement('button');
      tag.className = 'word-chip in-answer';
      tag.textContent = chip.dataset.word;
      tag.addEventListener('click', () => {
        if (answered) return;
        const i = selected.findIndex(s => s.idx === chip.dataset.idx);
        if (i >= 0) selected.splice(i, 1);
        chip.style.visibility = 'visible';
        chip.classList.remove('used');
        tag.remove();
        if (selected.length < ex.words.length) checkBtn.style.display = 'none';
      });
      answerArea.appendChild(tag);

      if (selected.length >= ex.words.length) {
        checkBtn.style.display = 'inline-flex';
      }
    });
  });

  checkBtn.addEventListener('click', () => {
    if (answered) return;
    answered = true;

    const userAnswer = selected.map(s => s.word).join(' ');
    const correctAnswer = ex.words.join(' ');
    const correct = userAnswer === correctAnswer;

    results.push(correct);
    recordResult('sentences', scene.id, correct);

    const feedback = container.querySelector('#feedback');
    if (correct) {
      feedback.textContent = 'Correct! ✓';
      feedback.style.color = 'var(--success)';
      answerArea.classList.add('correct-answer');
    } else {
      feedback.textContent = ex.sentence.text;
      feedback.style.color = 'var(--error)';
      answerArea.classList.add('wrong-answer');
    }
    feedback.classList.add('visible');

    setTimeout(() => {
      currentExIndex++;
      renderExercise(container, data, scene);
    }, 1800);
  });
}

function bindFillBlankEvents(container, data, scene, ex) {
  container.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const selected = btn.dataset.word;
      const correct = selected === ex.blankWord;
      results.push(correct);
      recordResult('sentences', scene.id, correct);

      const feedback = container.querySelector('#feedback');
      if (correct) {
        btn.classList.add('correct');
        feedback.textContent = 'Correct! ✓';
        feedback.style.color = 'var(--success)';
      } else {
        btn.classList.add('wrong');
        feedback.textContent = ex.sentence.text;
        feedback.style.color = 'var(--error)';
        container.querySelectorAll('.option-btn').forEach(b => {
          if (b.dataset.word === ex.blankWord) b.classList.add('correct');
        });
      }
      feedback.classList.add('visible');
      speak(ex.sentence.text, 0.8);

      setTimeout(() => {
        currentExIndex++;
        renderExercise(container, data, scene);
      }, 1500);
    });
  });
}

function bindSentencePickEvents(container, data, scene, ex) {
  container.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const selected = btn.dataset.text;
      const correct = selected === ex.sentence.text;
      results.push(correct);
      recordResult('sentences', scene.id, correct);

      const feedback = container.querySelector('#feedback');
      if (correct) {
        btn.classList.add('correct');
        feedback.textContent = 'Correct! ✓';
        feedback.style.color = 'var(--success)';
      } else {
        btn.classList.add('wrong');
        feedback.textContent = ex.sentence.text;
        feedback.style.color = 'var(--error)';
        container.querySelectorAll('.option-btn').forEach(b => {
          if (b.dataset.text === ex.sentence.text) b.classList.add('correct');
        });
      }
      feedback.classList.add('visible');

      setTimeout(() => {
        currentExIndex++;
        renderExercise(container, data, scene);
      }, 1500);
    });
  });
}

function renderResult(container, data, scene) {
  const correct = results.filter(Boolean).length;
  const total = results.length;
  const pct = Math.round((correct / total) * 100);

  let icon, message;
  if (pct >= 80) { icon = '🌟'; message = 'Excellent! You speak like a 3-year-old!'; }
  else if (pct >= 60) { icon = '👏'; message = 'Good progress!'; }
  else { icon = '💪'; message = 'Practice makes perfect!'; }

  container.innerHTML = `
    <div class="toddler-page fade-in">
      <div class="scene-header">
        <button class="btn-back" onclick="navigateTo('sentences')">←</button>
        <h2>${scene.icon} ${scene.nameCN}</h2>
        <span class="scene-counter">Result</span>
      </div>
      <div class="exercise-result">
        <div class="result-icon">${icon}</div>
        <h3>${correct} / ${total}</h3>
        <p>${message}</p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
          <button class="btn-primary" id="btn-retry">再来一次</button>
          <button class="btn-secondary" onclick="navigateTo('sentences')">返回场景</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-retry').addEventListener('click', () => {
    startExercises(container, data, scene.id);
  });
}
