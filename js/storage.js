const STORAGE_KEY = 'babyEnglish_v3';

const DEFAULT_PROGRESS = {
  mastered: [],
  masteredSentences: []
};

export function loadProgress() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...DEFAULT_PROGRESS, ...parsed };
    }
  } catch (e) {}
  return { ...DEFAULT_PROGRESS };
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function toggleMastered(word) {
  const progress = loadProgress();
  const idx = progress.mastered.indexOf(word);
  if (idx >= 0) {
    progress.mastered.splice(idx, 1);
  } else {
    progress.mastered.push(word);
  }
  saveProgress(progress);
  return progress;
}

export function toggleMasteredSentence(sentence) {
  const progress = loadProgress();
  const idx = progress.masteredSentences.indexOf(sentence);
  if (idx >= 0) {
    progress.masteredSentences.splice(idx, 1);
  } else {
    progress.masteredSentences.push(sentence);
  }
  saveProgress(progress);
  return progress;
}

export function isMastered(word) {
  return loadProgress().mastered.includes(word);
}

export function isSentenceMastered(sentence) {
  return loadProgress().masteredSentences.includes(sentence);
}

export function getMasteredCount() {
  const p = loadProgress();
  return p.mastered.length + p.masteredSentences.length;
}

export function getSceneMasteredCount(scene) {
  const p = loadProgress();
  let wordCount = 0;
  let totalWords = 0;
  for (const group of scene.groups) {
    for (const w of group.words) {
      totalWords++;
      if (p.mastered.includes(w.en)) wordCount++;
    }
  }
  return { mastered: wordCount, total: totalWords };
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}
