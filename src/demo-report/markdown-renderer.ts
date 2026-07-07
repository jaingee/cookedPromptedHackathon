/**
 * cookedPrompts - Demo Report Markdown Renderer
 *
 * Pure deterministic serializer: same input -> same string.
 * No I/O, no mutation, no prompt_text, no raw JSON in output.
 */

import type { DemoReport, ReportSection } from './types.js';

/**
 * Serialize a DemoReport (without markdown field) to a deterministic markdown string.
 */
export function renderReportMarkdown(
  report: Omit<DemoReport, 'markdown'>,
): string {
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push('');

  if (report.summary) {
    lines.push(report.summary);
    lines.push('');
  }

  for (const section of report.sections) {
    lines.push(...renderSection(section));
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Generated at ${report.generated_at} by ${report.renderer_version}.*`);
  lines.push('');

  return lines.join('\n');
}

function renderSection(section: ReportSection): string[] {
  const lines: string[] = [];

  lines.push(`## ${section.heading}`);
  lines.push('');

  if (section.summary) {
    lines.push(section.summary);
    lines.push('');
  }

  if (section.metrics && section.metrics.length > 0) {
    for (const metric of section.metrics) {
      const val = metric.value !== null ? String(metric.value) : 'N/A';
      const unit = metric.unit ? ` ${metric.unit}` : '';
      lines.push(`- **${metric.label}**: ${val}${unit}`);
    }
    lines.push('');
  }

  if (
    section.overall_score_100 !== undefined ||
    section.score_band !== undefined
  ) {
    const score =
      section.overall_score_100 !== null &&
      section.overall_score_100 !== undefined
        ? section.overall_score_100
        : 'N/A';
    const band = section.score_band ?? 'N/A';
    lines.push(`- **Score**: ${score} / 100`);
    lines.push(`- **Band**: ${band}`);
    lines.push('');
  }

  if (section.category_scores_100 && section.category_scores_100.length > 0) {
    for (const item of section.category_scores_100) {
      const score = item.score_100 !== null ? item.score_100 : 'N/A';
      const band = item.score_band ?? 'N/A';
      lines.push(`- **${item.category}**: ${score} / 100 (${band})`);
      if (item.coaching_note) {
        lines.push(`  - ${item.coaching_note}`);
      }
    }
    lines.push('');
  }

  if (section.kind === 'prompt_examples' && section.prompt_example_cards && section.prompt_example_cards.length > 0) {
    section.prompt_example_cards.forEach((card, index) => {
      const label = card.top_issue_labels[0] ?? card.score_band ?? 'Prompt';
      const score = card.overall_score_100 !== null ? card.overall_score_100 : 'N/A';
      const band = card.score_band ?? 'N/A';
      const fence = makeCodeFence(card.prompt_excerpt);

      lines.push(`### Example ${index + 1} — ${label}`);
      lines.push('');
      lines.push(`**Score:** ${score} / 100 — ${band}`);
      lines.push('');
      lines.push('**Original prompt excerpt**');
      lines.push(`${fence}text`);
      lines.push(card.prompt_excerpt);
      lines.push(fence);
      lines.push('');
      lines.push('**What went wrong**');
      lines.push(card.what_went_wrong);
      lines.push('');
      lines.push('**Why it matters**');
      lines.push(card.why_it_matters);
      lines.push('');
      lines.push('**Habit to build**');
      lines.push(card.habit_to_build);
      lines.push('');

      lines.push('**A stronger version**');
      lines.push(`${fence}text`);
      lines.push(card.improved_prompt);
      lines.push(fence);
      lines.push('');

      lines.push('**Why this works**');
      lines.push(card.why_it_works);
      lines.push('');

      if (card.top_issue_labels.length > 0) {
        lines.push(`- **Top issues**: ${card.top_issue_labels.join(', ')}`);
        lines.push('');
      }
    });
  }

  if (section.kind === 'roast_of_the_batch') {
    if (section.roast_line) {
      lines.push(`> ${section.roast_line}`);
      lines.push('');
    }

    if (section.prompt_excerpt) {
      const fence = makeCodeFence(section.prompt_excerpt);
      lines.push('**Prompt excerpt**');
      lines.push(`${fence}text`);
      lines.push(section.prompt_excerpt);
      lines.push(fence);
      lines.push('');
    }

    if (section.target_issue) {
      lines.push(`- **Target issue**: ${section.target_issue}`);
    }

    if (section.coaching_reason) {
      lines.push(`- **Why this one hurt**: ${section.coaching_reason}`);
    }

    if (section.target_issue || section.coaching_reason) {
      lines.push('');
    }
  }

  if (section.kind === 'copy_worthy_prompt') {
    if (section.prompt_excerpt) {
      const fence = makeCodeFence(section.prompt_excerpt);
      lines.push(`${fence}text`);
      lines.push(section.prompt_excerpt);
      lines.push(fence);
      lines.push('');
    }

    if (section.why_it_works) {
      lines.push('**Why it works**');
      lines.push(section.why_it_works);
      lines.push('');
    }

    if (section.copy_pattern) {
      lines.push('**Pattern to copy**');
      lines.push(section.copy_pattern);
      lines.push('');
    }
  }

  if (section.kind === 'model_waste') {
    if (section.overkill_count !== undefined) {
      lines.push(`- **Overkill**: ${section.overkill_count}`);
    }
    if (section.underfit_count !== undefined) {
      lines.push(`- **Underfit**: ${section.underfit_count}`);
    }
    if (section.coaching_summary) {
      lines.push(`- **Coaching**: ${section.coaching_summary}`);
    }
    if (section.teaching_points && section.teaching_points.length > 0) {
      for (const point of section.teaching_points) {
        lines.push(`- ${point}`);
      }
    }
    if (section.example_hints && section.example_hints.length > 0) {
      for (const hint of section.example_hints) {
        lines.push(`- ${hint}`);
      }
    }
    lines.push('');
  }

  if (section.kind === 'safety_privacy_lessons') {
    if (section.coaching_summary) {
      lines.push(`- **Coaching**: ${section.coaching_summary}`);
    }
    if (section.risk_category_counts && section.risk_category_counts.length > 0) {
      for (const entry of section.risk_category_counts) {
        lines.push(`- **${entry.category}**: ${entry.count} (${entry.severity})`);
      }
    }
    if (section.lesson_items && section.lesson_items.length > 0) {
      for (const item of section.lesson_items) {
        lines.push(`- ${item}`);
      }
    }
    if (section.placeholder_examples && section.placeholder_examples.length > 0) {
      for (const example of section.placeholder_examples) {
        lines.push(`- ${example}`);
      }
    }
    if (section.redacted_prompt_hint) {
      lines.push(`- ${section.redacted_prompt_hint}`);
    }
    lines.push('');
  }

  if (section.items && section.items.length > 0) {
    if (section.kind === 'next_actions') {
      for (let i = 0; i < section.items.length; i++) {
        lines.push(`${i + 1}. ${section.items[i]}`);
      }
    } else {
      for (const item of section.items) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');
  }

  if (section.coaching_notes && section.coaching_notes.length > 0) {
    for (const note of section.coaching_notes) {
      lines.push(`*${note}*`);
    }
    lines.push('');
  }

  return lines;
}

function makeCodeFence(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longestRun + 1));
}
