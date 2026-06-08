import { preloadVoices } from './audio.js';
import { renderHome, renderSceneList } from './stages/home.js';
import { renderLearn } from './stages/learn.js';
import { renderMastered } from './stages/mastered.js';

const app = document.getElementById('app');

let levelData = {};

export async function getLevelData(level) {
  if (levelData[level]) return levelData[level];
  const res = await fetch(`./data/level-${level}.json`);
  levelData[level] = await res.json();
  return levelData[level];
}

const routes = {
  '': renderHome,
  'level': renderSceneList,
  'learn': renderLearn,
  'mastered': renderMastered
};

function navigate(hash) {
  const parts = hash.replace('#/', '').split('/');
  const route = parts[0] || '';
  const params = parts.slice(1);
  const renderer = routes[route];
  if (renderer) {
    app.innerHTML = '';
    window.scrollTo(0, 0);
    renderer(app, params);
  }
}

window.addEventListener('hashchange', () => navigate(location.hash));

window.navigateTo = function(path) {
  location.hash = '#/' + path;
};

preloadVoices().then(() => {
  if (!location.hash || location.hash === '#/') {
    navigate('');
  } else {
    navigate(location.hash);
  }
});
