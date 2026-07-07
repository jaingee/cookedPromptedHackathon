/**
 * cookedPrompts — Dashboard UI Layout
 *
 * Server-rendered HTML for the local dashboard UI.
 */

import type { DashboardUiPageModel } from './types.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderNavLink(href: string, label: string, isActive: boolean): string {
  const ariaCurrent = isActive ? ' aria-current="page"' : '';
  const className = isActive ? 'nav-link is-active' : 'nav-link';
  return `<a class="${className}" href="${href}"${ariaCurrent}>${label}</a>`;
}

function renderMetricCards(model: DashboardUiPageModel): string {
  if (model.metric_cards.length === 0) return '';

  return model.metric_cards.map((card) => [
    '      <div class="panel">',
    `        <div class="eyebrow">${escapeHtml(card.label)}</div>`,
    `        <div class="metric">${escapeHtml(card.value)}</div>`,
    card.detail ? `        <p>${escapeHtml(card.detail)}</p>` : '',
    '      </div>',
  ].filter(Boolean).join('\n')).join('\n');
}

function renderSummarySections(model: DashboardUiPageModel): string {
  if (model.summary_sections.length === 0) return '';

  return model.summary_sections.map((section) => {
    const items = section.items.length > 0
      ? [
          '        <ul class="summary-list">',
          ...section.items.map((item) => [
            '          <li class="summary-item">',
            `            <strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}`,
            item.detail ? `            <span class="summary-detail">${escapeHtml(item.detail)}</span>` : '',
            '          </li>',
          ].filter(Boolean).join('\n')),
          '        </ul>',
        ].join('\n')
      : `        <p>${escapeHtml(section.empty_message)}</p>`;

    return [
      '      <section class="subsection">',
      `        <h3>${escapeHtml(section.title)}</h3>`,
      items,
      '      </section>',
    ].join('\n');
  }).join('\n');
}

function renderPromptList(model: DashboardUiPageModel): string {
  if (model.shell.active_route !== 'prompts') {
    return '';
  }

  if (model.prompt_list.length === 0) {
    return '      <p>No scored prompts match this page yet.</p>';
  }

  return [
    '      <div class="prompt-list">',
    ...model.prompt_list.map((item) => [
      '        <article class="prompt-item">',
      '          <div class="prompt-item-header">',
      `            <a class="prompt-link" href="${escapeHtml(item.detail_href)}">${escapeHtml(item.score_id)}</a>`,
      `            <span class="status-chip">${escapeHtml(item.score_summary)}</span>`,
      '          </div>',
      '          <div class="prompt-meta">',
      `            <span>${escapeHtml(item.timestamp_label)}</span>`,
      `            <span>${escapeHtml(item.model_label)}</span>`,
      `            <span>${escapeHtml(item.source_label)}</span>`,
      `            <span>${escapeHtml(item.confidence)} confidence</span>`,
      '          </div>',
      '          <div class="prompt-meta">',
      `            <span>${escapeHtml(item.model_fit_status)}</span>`,
      `            <span>${escapeHtml(item.safety_status)}</span>`,
      '          </div>',
      item.top_issue_labels.length > 0
        ? `          <p>${escapeHtml(item.top_issue_labels.join(' | '))}</p>`
        : '          <p>No recurring issue labels.</p>',
      '        </article>',
    ].join('\n')),
    '      </div>',
  ].join('\n');
}

function renderPagination(model: DashboardUiPageModel): string {
  if (model.shell.active_route !== 'prompts' || !model.pagination) return '';

  return [
    '      <nav class="pagination" aria-label="Prompt list pagination">',
    model.pagination.previous_href
      ? `        <a class="nav-link" href="${escapeHtml(model.pagination.previous_href)}">Previous</a>`
      : '        <span class="pagination-disabled">Previous</span>',
    `        <span>Page ${model.pagination.current_page} of ${model.pagination.total_pages}</span>`,
    model.pagination.next_href
      ? `        <a class="nav-link" href="${escapeHtml(model.pagination.next_href)}">Next</a>`
      : '        <span class="pagination-disabled">Next</span>',
    '      </nav>',
  ].join('\n');
}

function renderPromptDetail(model: DashboardUiPageModel): string {
  if (model.shell.active_route !== 'prompt_detail' || !model.prompt_detail) {
    return '';
  }

  const detail = model.prompt_detail;
  const issueLabels =
    detail.issue_labels.length > 0
      ? detail.issue_labels.map((label) => `<span class="status-chip">${escapeHtml(label)}</span>`).join('\n')
      : '<span class="summary-detail">No recurring issue labels.</span>';
  const explanations =
    detail.explanations.length > 0
      ? [
          '      <ul class="summary-list">',
          ...detail.explanations.map((explanation) => [
            '        <li class="summary-item">',
            `          <span>${escapeHtml(explanation)}</span>`,
            '        </li>',
          ].join('\n')),
          '      </ul>',
        ].join('\n')
      : '      <p>No coaching explanations are available for this prompt yet.</p>';
  const scoreBreakdown = [
    '      <ul class="summary-list">',
    ...detail.score_breakdown.map((row) => [
      '        <li class="summary-item">',
      `          <strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}`,
      '        </li>',
    ].join('\n')),
    '      </ul>',
  ].join('\n');
  const metadata = [
    '      <ul class="summary-list">',
    ...detail.metadata.map((row) => [
      '        <li class="summary-item">',
      `          <strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}`,
      '        </li>',
    ].join('\n')),
    '      </ul>',
  ].join('\n');

  return [
    '      <div class="detail-toolbar">',
    `        <a class="nav-link" href="${escapeHtml(detail.back_href)}">Back to prompt list</a>`,
    `        <span class="status-chip">${escapeHtml(detail.overall_score_summary)}</span>`,
    '      </div>',
    '      <section class="subsection">',
    '        <h3>Prompt summary</h3>',
    '        <div class="prompt-meta">',
    `          <span>${escapeHtml(detail.score_id)}</span>`,
    `          <span>${escapeHtml(detail.confidence)} confidence</span>`,
    `          <span>${escapeHtml(detail.model_fit_status)}</span>`,
    `          <span>${escapeHtml(detail.safety_status)}</span>`,
    '        </div>',
    '      </section>',
    '      <section class="subsection">',
    `        <h3>${escapeHtml(detail.prompt_text_heading)}</h3>`,
    `        <p class="summary-detail">${escapeHtml(detail.prompt_text_note)}</p>`,
    `        <pre class="prompt-text-block"><code>${escapeHtml(detail.prompt_text)}</code></pre>`,
    '      </section>',
    '      <section class="subsection">',
    '        <h3>Score breakdown</h3>',
    scoreBreakdown,
    '      </section>',
    '      <section class="subsection">',
    '        <h3>Issue labels</h3>',
    `        <div class="chip-row">${issueLabels}</div>`,
    '      </section>',
    '      <section class="subsection">',
    '        <h3>Coaching notes</h3>',
    explanations,
    '      </section>',
    '      <section class="subsection">',
    '        <h3>Prompt metadata</h3>',
    metadata,
    '      </section>',
  ].join('\n');
}

export function renderDashboardUiDocument(model: DashboardUiPageModel): string {
  const { shell } = model;
  const documentTitle = `${shell.app_title} - ${model.page_title}`;
  const nav = [
    renderNavLink('/', 'Overview', shell.active_route === 'overview'),
    renderNavLink('/prompts', 'Prompts', shell.active_route === 'prompts'),
  ].join('');
  const scoreStatus = shell.has_scores
    ? `${shell.total_scored} scored prompts ready for the dashboard.`
    : 'No scored prompts yet.';

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(documentTitle)}</title>`,
    '  <style>',
    '    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; }',
    '    body { margin: 0; background: #f5f7fb; color: #172033; }',
    '    .shell { max-width: 980px; margin: 0 auto; padding: 24px; }',
    '    .hero { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }',
    '    .badge { display: inline-block; width: fit-content; background: #e8eefc; color: #24439b; padding: 6px 10px; border-radius: 999px; font-size: 14px; font-weight: 600; }',
    '    .nav { display: flex; gap: 12px; margin: 8px 0 0; }',
    '    .nav-link { color: #3350a8; text-decoration: none; padding: 8px 0; font-weight: 600; }',
    '    .nav-link.is-active { color: #172033; border-bottom: 2px solid #172033; }',
    '    .panel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }',
    '    .panel { background: #ffffff; border: 1px solid #d8dfef; border-radius: 8px; padding: 16px; }',
    '    .eyebrow { font-size: 13px; color: #586783; margin-bottom: 8px; }',
    '    .metric { font-size: 28px; font-weight: 700; }',
    '    .page { background: #ffffff; border: 1px solid #d8dfef; border-radius: 8px; padding: 20px; }',
    '    .subsection { margin-top: 20px; }',
    '    .subsection h3 { margin: 0 0 10px; font-size: 17px; }',
    '    .summary-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }',
    '    .summary-item { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid #edf1f8; }',
    '    .summary-item:first-child { border-top: 0; padding-top: 0; }',
    '    .summary-detail { color: #586783; font-size: 14px; }',
    '    .prompt-list { display: grid; gap: 16px; margin-top: 18px; }',
    '    .prompt-item { border: 1px solid #e1e7f3; border-radius: 8px; padding: 16px; }',
    '    .prompt-item-header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }',
    '    .prompt-link { color: #24439b; font-weight: 700; text-decoration: none; }',
    '    .prompt-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; color: #586783; font-size: 14px; }',
    '    .status-chip { background: #eef2fb; color: #24439b; border-radius: 999px; padding: 4px 10px; font-size: 13px; font-weight: 600; }',
    '    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }',
    '    .notice { margin-top: 16px; padding: 12px 14px; border-radius: 8px; background: #fff4d6; color: #725100; }',
    '    .pagination { display: flex; gap: 16px; align-items: center; margin-top: 18px; }',
    '    .pagination-disabled { color: #95a1b8; }',
    '    .detail-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }',
    '    .prompt-text-block { margin-top: 12px; padding: 16px; border: 1px solid #e1e7f3; border-radius: 8px; background: #f8faff; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; font-family: Consolas, "Courier New", monospace; font-size: 14px; line-height: 1.6; }',
    '    h1, h2, h3, p { margin: 0; }',
    '    .page p { margin-top: 10px; line-height: 1.5; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="shell">',
    '    <header class="hero">',
    '      <span class="badge">Local-only dashboard</span>',
    `      <h1>${escapeHtml(shell.app_title)}</h1>`,
    '      <p>Local browser view. No cloud. No telemetry. No provider calls.</p>',
    `      <nav class="nav">${nav}</nav>`,
    '    </header>',
    '    <section class="panel-grid">',
    '      <div class="panel">',
    '        <div class="eyebrow">Database</div>',
    `        <div class="metric">${escapeHtml(shell.database_label)}</div>`,
    '      </div>',
    '      <div class="panel">',
    '        <div class="eyebrow">Scored prompts</div>',
    `        <div class="metric">${shell.total_scored}</div>`,
    `        <p>${escapeHtml(scoreStatus)}</p>`,
    '      </div>',
    renderMetricCards(model),
    '    </section>',
    '    <main class="page">',
    `      <div class="eyebrow">${escapeHtml(model.eyebrow)}</div>`,
    `      <h2>${escapeHtml(model.heading)}</h2>`,
    `      <p>${escapeHtml(model.intro)}</p>`,
    model.route_notice ? `      <div class="notice">${escapeHtml(model.route_notice)}</div>` : '',
    renderSummarySections(model),
    renderPromptList(model),
    renderPromptDetail(model),
    renderPagination(model),
    '    </main>',
    '  </div>',
    '</body>',
    '</html>',
  ].filter(Boolean).join('\n');
}
