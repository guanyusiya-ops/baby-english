export function renderProgressBar(current, total, color = 'var(--accent)') {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return `
    <div class="stage-progress-bar">
      <div class="stage-progress-fill" style="width: ${pct}%; background: ${color}"></div>
    </div>
  `;
}
