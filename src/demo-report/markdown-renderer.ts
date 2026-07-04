/**
 * cookedPrompts — Demo Report Markdown Renderer
 *
 * Pure deterministic serializer: same input → same string.
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

  // Title
  lines.push(`# ${report.title}`);
  lines.push('');

  // Summary paragraph
  if (report.summary) {
    lines.push(report.summary);
    lines.push('');
  }

  // Sections
  for (const section of report.sections) {
    lines.push(...renderSection(section));
  }

  // Generated at footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated at ${report.generated_at} by ${report.renderer_version}.*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render a single section to markdown lines.
 */
function renderSection(section: ReportSection): string[] {
  const lines: string[] = [];

  lines.push(`## ${section.heading}`);
  lines.push('');

  // Summary
  if (section.summary) {
    lines.push(section.summary);
    lines.push('');
  }

  // Metrics as bullet list
  if (section.metrics && section.metrics.length > 0) {
    for (const metric of section.metrics) {
      const val = metric.value !== null ? String(metric.value) : 'N/A';
      const unit = metric.unit ? ` ${metric.unit}` : '';
      lines.push(`- **${metric.label}**: ${val}${unit}`);
    }
    lines.push('');
  }

  // Items — next_actions as numbered list, others as bullets
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

  // Coaching notes as italic
  if (section.coaching_notes && section.coaching_notes.length > 0) {
    for (const note of section.coaching_notes) {
      lines.push(`*${note}*`);
    }
    lines.push('');
  }

  return lines;
}
