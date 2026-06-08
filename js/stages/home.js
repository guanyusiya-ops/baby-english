import { getMasteredCount, getSceneMasteredCount } from '../storage.js';
import { getLevelData } from '../app.js';

export function renderHome(container) {
  const masteredCount = getMasteredCount();

  container.innerHTML = `
    <div class="home-page fade-in">
      <div class="home-header">
        <div class="home-icon">👶</div>
        <h1>婴式英语</h1>
        <p class="home-subtitle">像婴儿一样学英语</p>
        <p class="home-desc">按年龄分级的日常口语词汇与句子<br>中英对照 · 点击发音 · 标记已会</p>
      </div>

      <div class="level-list">
        <div class="level-card active" onclick="navigateTo('level/3yo')">
          <span class="level-badge">3岁</span>
          <div class="level-info">
            <h3>3岁级 · 基础日常</h3>
            <p>日常生活基础词汇，吃饭、穿衣、玩耍、家人</p>
          </div>
          <span class="level-arrow">→</span>
        </div>
        <div class="level-card active" onclick="navigateTo('level/6yo')">
          <span class="level-badge">6岁</span>
          <div class="level-info">
            <h3>6岁级 · 扩展表达</h3>
            <p>学校、社交、自然科学、时间与日历</p>
          </div>
          <span class="level-arrow">→</span>
        </div>
        <div class="level-card active" onclick="navigateTo('level/12yo')">
          <span class="level-badge">12岁</span>
          <div class="level-info">
            <h3>12岁级 · 流利对话</h3>
            <p>学术词汇、抽象概念、习语与辩论</p>
          </div>
          <span class="level-arrow">→</span>
        </div>
      </div>

      <div class="mastered-entry" onclick="navigateTo('mastered')">
        <span class="mastered-icon">✅</span>
        <span>已掌握</span>
        <span class="mastered-count">${masteredCount} 个</span>
        <span class="level-arrow">→</span>
      </div>
    </div>
  `;
}

export async function renderSceneList(container, params) {
  const level = params && params[0] || '3yo';
  const data = await getLevelData(level);

  container.innerHTML = `
    <div class="scene-list-page fade-in">
      <div class="page-header">
        <button class="btn-back" onclick="navigateTo('')">←</button>
        <h2>${data.levelName}</h2>
        <span class="header-info">${data._meta.totalWords} 词</span>
      </div>
      <div class="scene-grid">
        ${data.scenes.map(scene => {
          const { mastered, total } = getSceneMasteredCount(scene);
          const pct = total > 0 ? Math.round(mastered / total * 100) : 0;
          return `
            <div class="scene-card ${mastered >= total && total > 0 ? 'done' : ''}" onclick="navigateTo('learn/${level}/${scene.id}')">
              <div class="scene-card-icon">${scene.icon}</div>
              <div class="scene-card-name">${scene.nameCN}</div>
              <div class="scene-card-progress">
                <div class="mini-progress-bar">
                  <div class="mini-progress-fill" style="width: ${pct}%"></div>
                </div>
                <span class="scene-card-count">${mastered}/${total}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
