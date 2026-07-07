/**
 * cookedPrompts - Demo Report Prompt Coaching Builders
 *
 * Deterministic prompt example selection and coaching copy for local reports.
 * Uses redacted excerpts only. No raw prompt_text, no model answers, no secrets.
 */

import type { PromptResult } from '../integration-demo/types.js';
import type { PromptExampleCard, ReportSection } from './types.js';
import { PROMPT_EXCERPT_WITHHELD, buildRedactedExcerpt } from './redaction.js';
import { getScoreBand, toScore100 } from './scorecard.js';
import {
  ISSUE_LABEL_COACHING_NOTES,
  humanizeIssueLabel,
} from './coaching-copy.js';
import type { ScoringIssueLabel } from '../scoring/types.js';

const DEFAULT_MAX_PROMPT_EXAMPLES = 3;
const MAX_ISSUE_LABELS_PER_CARD = 3;

const SAFETY_SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const ROAST_FOCUS_RANK: Record<string, number> = {
  missing_context: 5,
  unclear_task: 5,
  missing_constraints: 4,
  missing_output_format: 4,
  overbroad_prompt: 4,
  too_long_for_task: 3,
  wrong_model_class: 3,
  overpowered_model: 3,
  needs_search: 2,
  needs_tool_use: 2,
  privacy_risk: 1,
  possible_secret: 1,
};

interface PromptExampleCandidate {
  prompt_log_id: string;
  prompt_length: number;
  prompt_excerpt: string;
  prompt_excerpt_is_readable: boolean;
  overall_score_100: number;
  score_band: NonNullable<ReturnType<typeof getScoreBand>>;
  issue_labels: string[];
  top_issue_labels: string[];
  primary_issue_key: string;
  primary_issue_label: string;
  issue_count: number;
  safety_rank: number;
  warning_count: number;
  roast_focus_rank: number;
  redaction_placeholder_total: number;
}

interface HighlightSelection {
  roast_of_the_batch: ReportSection | null;
  copy_worthy_prompt: ReportSection | null;
}

/**
 * Build a prompt example section from prompt results.
 * Returns null when there are no eligible examples.
 */
export function buildPromptExamplesSection(
  promptResults: PromptResult[],
  maxPromptExamples: number = DEFAULT_MAX_PROMPT_EXAMPLES,
): ReportSection | null {
  const candidates = buildPromptExampleCandidates(promptResults);
  const cards = selectPromptExampleCards(candidates, maxPromptExamples);

  if (cards.length === 0) {
    return null;
  }

  return {
    kind: 'prompt_examples',
    heading: 'Prompt Examples',
    summary:
      'Redacted local examples from the weakest prompts in this batch, plus stronger rewrite guidance. Sensitive spans are masked before display.',
    prompt_example_cards: cards,
  };
}

/**
 * Build the roast and copy-worthy highlight sections.
 * The copy-worthy prompt is selected first so the roast can avoid duplicating it when possible.
 */
export function buildPromptHighlightsSections(
  promptResults: PromptResult[],
): HighlightSelection {
  const candidates = buildPromptExampleCandidates(promptResults);
  const copyCandidate = selectCopyWorthyCandidate(candidates);
  const excludedIds = copyCandidate ? new Set([copyCandidate.prompt_log_id]) : new Set<string>();

  return {
    roast_of_the_batch: buildRoastOfTheBatchSection(candidates, excludedIds),
    copy_worthy_prompt: copyCandidate
      ? buildCopyWorthyPromptSection(copyCandidate)
      : null,
  };
}

function buildPromptExampleCandidates(
  promptResults: PromptResult[],
): PromptExampleCandidate[] {
  return promptResults
    .map(buildCandidate)
    .filter((candidate): candidate is PromptExampleCandidate => candidate !== null);
}

function selectPromptExampleCards(
  candidates: PromptExampleCandidate[],
  maxPromptExamples: number,
): PromptExampleCard[] {
  const maxExamples = Math.max(0, Math.min(maxPromptExamples, DEFAULT_MAX_PROMPT_EXAMPLES));
  if (maxExamples === 0 || candidates.length === 0) {
    return [];
  }

  const readableCandidates = candidates.filter((candidate) => candidate.prompt_excerpt_is_readable);
  const fallbackCandidates = candidates.filter((candidate) => !candidate.prompt_excerpt_is_readable);

  const selected = selectCandidates(readableCandidates, compareWeakCandidates, maxExamples);
  if (selected.length < maxExamples) {
    const remaining = maxExamples - selected.length;
    const fallbackSelection = selectCandidates(
      fallbackCandidates,
      compareWeakCandidates,
      remaining,
      new Set(selected.map((candidate) => candidate.prompt_log_id)),
    );
    selected.push(...fallbackSelection);
  }

  return selected.map(buildPromptExampleCard);
}

function buildCandidate(result: PromptResult): PromptExampleCandidate | null {
  if (result.error || result.failed_step) {
    return null;
  }

  const promptText = typeof result.prompt_text === 'string' ? result.prompt_text.trim() : '';
  if (!promptText) {
    return null;
  }

  const scoreValue = result.score?.overall_score;
  const overallScore100 = toScore100(scoreValue);
  if (overallScore100 === null) {
    return null;
  }

  const scoreBand = getScoreBand(overallScore100);
  if (scoreBand === null) {
    return null;
  }

  const issueLabels = Array.isArray(result.score?.issue_labels)
    ? result.score!.issue_labels.filter((label): label is ScoringIssueLabel => label.length > 0)
    : [];
  const topIssueLabels = Array.from(new Set(issueLabels))
    .slice(0, MAX_ISSUE_LABELS_PER_CARD)
    .map((label) => humanizeIssueLabel(label));

  const safetyRank = getSafetyRank(result);
  const warningCount = result.safety_result?.warnings?.length ?? 0;
  const redaction = buildRedactedExcerpt(promptText);
  const prompt_excerpt = redaction.redacted_excerpt;
  const prompt_excerpt_is_readable = prompt_excerpt !== PROMPT_EXCERPT_WITHHELD;
  const primaryIssueKey = derivePrimaryIssueKey(result, issueLabels, safetyRank);
  const primaryIssueLabel = derivePrimaryIssueLabel(result, issueLabels, scoreBand, safetyRank);
  const redaction_placeholder_total = Object.values(redaction.placeholder_counts)
    .reduce((sum, count) => sum + count, 0);

  return {
    prompt_log_id: result.prompt_log_id,
    prompt_length: promptText.length,
    prompt_excerpt,
    prompt_excerpt_is_readable,
    redaction_placeholder_total,
    overall_score_100: overallScore100,
    score_band: scoreBand,
    issue_labels: issueLabels,
    top_issue_labels: topIssueLabels,
    primary_issue_key: primaryIssueKey,
    primary_issue_label: primaryIssueLabel,
    issue_count: issueLabels.length,
    safety_rank: safetyRank,
    warning_count: warningCount,
    roast_focus_rank: getRoastFocusRank(issueLabels, safetyRank),
  };
}

function buildPromptExampleCard(
  candidate: PromptExampleCandidate,
): PromptExampleCard {
  return {
    prompt_excerpt: candidate.prompt_excerpt,
    overall_score_100: candidate.overall_score_100,
    score_band: candidate.score_band,
    top_issue_labels: candidate.top_issue_labels,
    what_went_wrong: explainWhatWentWrong(candidate),
    why_it_matters: explainWhyItMatters(candidate),
    habit_to_build: explainHabitToBuild(candidate),
    improved_prompt: buildImprovedPrompt(candidate),
    why_it_works: explainWhyItWorks(candidate),
  };
}

function buildImprovedPrompt(candidate: PromptExampleCandidate): string {
  const issueSet = new Set(candidate.issue_labels);
  const hasContextGap =
    issueSet.has('missing_context') ||
    issueSet.has('unclear_task') ||
    issueSet.has('overbroad_prompt') ||
    issueSet.has('too_long_for_task') ||
    candidate.prompt_length < 120;
  const hasConstraintsGap =
    issueSet.has('missing_constraints') ||
    issueSet.has('overbroad_prompt') ||
    issueSet.has('too_long_for_task');
  const hasOutputFormatGap =
    issueSet.has('missing_output_format') ||
    candidate.score_band === 'Poor' ||
    candidate.score_band === 'Okay';
  const hasModelFitGap =
    issueSet.has('wrong_model_class') ||
    issueSet.has('overpowered_model');
  const hasSearchGap = issueSet.has('needs_search');
  const hasToolGap = issueSet.has('needs_tool_use');
  const hasSafetyGap =
    candidate.redaction_placeholder_total > 0 ||
    candidate.safety_rank > 0 ||
    issueSet.has('privacy_risk') ||
    issueSet.has('possible_secret');

  const lines: string[] = ['I need help with [task].', ''];

  if (hasContextGap) {
    lines.push(
      'Context:',
      '- [background the model needs]',
      '- [what I have already tried]',
      '- [who this is for or what success looks like]',
      '',
    );
  }

  if (hasConstraintsGap) {
    lines.push(
      'Constraints:',
      '- [length, tone, audience, or other limits]',
      '- [must not do or assume]',
      '',
    );
  }

  if (hasOutputFormatGap) {
    lines.push(
      'Output format:',
      '- [exact shape I want back]',
      '- [sections, fields, or structure to preserve]',
      '',
    );
  }

  if (hasSearchGap) {
    lines.push(
      'Research:',
      '- [sources or citations to use]',
      '- [what should be verified instead of guessed]',
      '',
    );
  }

  if (hasToolGap) {
    lines.push(
      'Workflow:',
      '- [tools, steps, or checks to use]',
      '- [when to stop and report back]',
      '',
    );
  }

  if (hasModelFitGap) {
    lines.push(
      'Model fit:',
      '- Use the smallest model that can still do this job well.',
      '- Explain the tradeoff if the task really needs more reasoning depth.',
      '',
    );
  }

  if (hasSafetyGap) {
    lines.push(
      'Safety and privacy:',
      '- Do not include secrets, passwords, tokens, private hostnames, or personal data.',
      '- Replace sensitive details with placeholders before reuse.',
      '',
    );
  }

  lines.push('Please focus on [success criteria].');
  return trimBlankLines(lines).join('\n');
}

function explainWhyItWorks(candidate: PromptExampleCandidate): string {
  const reasons: string[] = ['It gives the model a clear task.'];
  const issueSet = new Set(candidate.issue_labels);

  if (
    issueSet.has('missing_context') ||
    issueSet.has('unclear_task') ||
    issueSet.has('overbroad_prompt') ||
    issueSet.has('too_long_for_task') ||
    candidate.prompt_length < 120
  ) {
    reasons.push('It adds the missing context so the answer has a real target.');
  }

  if (
    issueSet.has('missing_constraints') ||
    issueSet.has('overbroad_prompt') ||
    issueSet.has('too_long_for_task')
  ) {
    reasons.push('It pins down the boundaries instead of letting the model guess.');
  }

  if (issueSet.has('missing_output_format') || candidate.score_band !== 'Excellent') {
    reasons.push('It tells the model what shape the answer should take.');
  }

  if (issueSet.has('needs_search')) {
    reasons.push('It asks for grounded facts instead of guesses.');
  }

  if (issueSet.has('needs_tool_use')) {
    reasons.push('It nudges the work into a tool-based workflow instead of a pure guess.');
  }

  if (
    candidate.redaction_placeholder_total > 0 ||
    candidate.safety_rank > 0 ||
    issueSet.has('privacy_risk') ||
    issueSet.has('possible_secret')
  ) {
    reasons.push('It keeps sensitive data out by telling the model to use placeholders.');
  }

  if (issueSet.has('wrong_model_class') || issueSet.has('overpowered_model')) {
    reasons.push('It matches the task to the right amount of reasoning power.');
  }

  return joinSentences(reasons);
}

function compareWeakCandidates(
  a: PromptExampleCandidate,
  b: PromptExampleCandidate,
): number {
  if (a.overall_score_100 !== b.overall_score_100) {
    return a.overall_score_100 - b.overall_score_100;
  }

  if (a.issue_count !== b.issue_count) {
    return b.issue_count - a.issue_count;
  }

  if (a.safety_rank !== b.safety_rank) {
    return b.safety_rank - a.safety_rank;
  }

  if (a.warning_count !== b.warning_count) {
    return b.warning_count - a.warning_count;
  }

  if (a.prompt_length !== b.prompt_length) {
    return b.prompt_length - a.prompt_length;
  }

  return a.prompt_log_id.localeCompare(b.prompt_log_id);
}

function compareCopyCandidates(
  a: PromptExampleCandidate,
  b: PromptExampleCandidate,
): number {
  if (a.overall_score_100 !== b.overall_score_100) {
    return b.overall_score_100 - a.overall_score_100;
  }

  if (a.issue_count !== b.issue_count) {
    return a.issue_count - b.issue_count;
  }

  if (a.safety_rank !== b.safety_rank) {
    return a.safety_rank - b.safety_rank;
  }

  if (a.warning_count !== b.warning_count) {
    return a.warning_count - b.warning_count;
  }

  if (a.prompt_length !== b.prompt_length) {
    return b.prompt_length - a.prompt_length;
  }

  return a.prompt_log_id.localeCompare(b.prompt_log_id);
}

function compareRoastCandidates(
  a: PromptExampleCandidate,
  b: PromptExampleCandidate,
): number {
  if (a.roast_focus_rank !== b.roast_focus_rank) {
    return b.roast_focus_rank - a.roast_focus_rank;
  }

  if (a.overall_score_100 !== b.overall_score_100) {
    return a.overall_score_100 - b.overall_score_100;
  }

  if (a.issue_count !== b.issue_count) {
    return b.issue_count - a.issue_count;
  }

  if (a.safety_rank !== b.safety_rank) {
    return b.safety_rank - a.safety_rank;
  }

  if (a.warning_count !== b.warning_count) {
    return b.warning_count - a.warning_count;
  }

  if (a.prompt_length !== b.prompt_length) {
    return b.prompt_length - a.prompt_length;
  }

  return a.prompt_log_id.localeCompare(b.prompt_log_id);
}

function selectCandidates(
  candidates: PromptExampleCandidate[],
  comparator: (a: PromptExampleCandidate, b: PromptExampleCandidate) => number,
  maxExamples: number,
  alreadySelectedIds: Set<string> = new Set(),
): PromptExampleCandidate[] {
  if (maxExamples <= 0 || candidates.length === 0) {
    return [];
  }

  const sorted = [...candidates].sort(comparator);
  const selected: PromptExampleCandidate[] = [];
  const seenPrimaryIssues = new Set<string>();

  for (const candidate of sorted) {
    if (selected.length >= maxExamples) {
      break;
    }
    if (alreadySelectedIds.has(candidate.prompt_log_id)) {
      continue;
    }
    if (seenPrimaryIssues.has(candidate.primary_issue_key)) {
      continue;
    }
    selected.push(candidate);
    seenPrimaryIssues.add(candidate.primary_issue_key);
    alreadySelectedIds.add(candidate.prompt_log_id);
  }

  for (const candidate of sorted) {
    if (selected.length >= maxExamples) {
      break;
    }
    if (alreadySelectedIds.has(candidate.prompt_log_id)) {
      continue;
    }
    selected.push(candidate);
    alreadySelectedIds.add(candidate.prompt_log_id);
  }

  return selected;
}

function selectCopyWorthyCandidate(
  candidates: PromptExampleCandidate[],
): PromptExampleCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const readableCandidates = candidates.filter((candidate) => candidate.prompt_excerpt_is_readable);
  const selectedPool = readableCandidates.length > 0 ? readableCandidates : candidates;
  return [...selectedPool].sort(compareCopyCandidates)[0] ?? null;
}

function buildRoastOfTheBatchSection(
  candidates: PromptExampleCandidate[],
  excludedPromptLogIds: Set<string>,
): ReportSection | null {
  if (candidates.length === 0) {
    return null;
  }

  const readableCandidates = candidates.filter((candidate) => candidate.prompt_excerpt_is_readable);
  const selectedPool = readableCandidates.length > 0 ? readableCandidates : candidates;
  const nonExcludedPool = selectedPool.filter((candidate) => !excludedPromptLogIds.has(candidate.prompt_log_id));
  const finalPool = nonExcludedPool.length > 0 ? nonExcludedPool : selectedPool;
  const selected = [...finalPool].sort(compareRoastCandidates)[0] ?? null;

  if (!selected) {
    return null;
  }

  return {
    kind: 'roast_of_the_batch',
    heading: 'Roast of the Batch',
    summary: 'The weakest lesson in the batch, made memorable without being mean.',
    roast_line: buildRoastLine(selected),
    coaching_reason: buildRoastReason(selected),
    target_issue: selected.primary_issue_label,
    prompt_excerpt: selected.prompt_excerpt_is_readable ? selected.prompt_excerpt : undefined,
  };
}

function buildCopyWorthyPromptSection(
  candidate: PromptExampleCandidate,
): ReportSection {
  return {
    kind: 'copy_worthy_prompt',
    heading: 'One Good Prompt Worth Copying',
    summary: 'The cleanest prompt in the batch, translated into a reusable habit.',
    prompt_excerpt: candidate.prompt_excerpt,
    overall_score_100: candidate.overall_score_100,
    score_band: candidate.score_band,
    why_it_works: buildCopyWhyItWorks(candidate),
    copy_pattern: buildCopyPattern(candidate),
  };
}

function buildRoastLine(candidate: PromptExampleCandidate): string {
  const firstIssue = candidate.issue_labels[0];
  if (firstIssue) {
    switch (firstIssue) {
      case 'missing_context':
        return 'This prompt showed up wearing a name tag and no instructions.';
      case 'unclear_task':
        return 'This prompt is a shrug pretending to be a brief.';
      case 'missing_constraints':
        return 'This prompt told the model what to do and skipped the part where it says how far to go.';
      case 'missing_output_format':
        return 'The model was asked to help, but nobody said whether the answer should be a list, a paragraph, or a spreadsheet.';
      case 'overbroad_prompt':
        return 'This prompt tried to order the whole buffet and expected one plate to hold it all.';
      case 'too_long_for_task':
        return 'This prompt packed a moving truck for a one-sentence job.';
      case 'privacy_risk':
        return 'This prompt brought private material into a public group chat.';
      case 'possible_secret':
        return 'This prompt treated secrets like harmless sample text.';
      case 'wrong_model_class':
        return 'This prompt rented a rocket for a trip across the street.';
      case 'overpowered_model':
        return 'This prompt hired the expensive brain for a job a smaller model could have handled.';
      case 'needs_search':
        return 'This prompt asked for facts like confidence could replace receipts.';
      case 'needs_tool_use':
        return 'This prompt wanted a workflow result from pure guesswork.';
      default:
        return `This prompt is still undercooked around ${humanizeIssueLabel(firstIssue).toLowerCase()}.`;
    }
  }

  if (candidate.safety_rank > 0) {
    return 'This prompt showed up with sensitive material still attached to it.';
  }

  return 'This prompt left the model to improvise the important parts.';
}

function buildRoastReason(candidate: PromptExampleCandidate): string {
  const firstIssue = candidate.issue_labels[0];
  if (firstIssue) {
    const note = ISSUE_LABEL_COACHING_NOTES[firstIssue];
    const label = humanizeIssueLabel(firstIssue);
    if (note) {
      return `It leaves ${label.toLowerCase()} unresolved, which makes the answer wobble and creates cleanup work later. ${note}`;
    }
    return `It leaves ${label.toLowerCase()} unresolved, which makes the answer wobble and creates cleanup work later.`;
  }

  if (candidate.safety_rank > 0) {
    return 'It exposes sensitive data before the model can help, so the first fix is to redact it.';
  }

  return 'It leaves the model guessing at the task, the target, and the shape of the answer.';
}

function buildCopyWhyItWorks(candidate: PromptExampleCandidate): string {
  const reasons: string[] = [];
  const issueSet = new Set(candidate.issue_labels);

  reasons.push('It names the task clearly without extra noise.');
  reasons.push('It gives the model enough context to stay on target.');

  if (
    issueSet.has('missing_constraints') ||
    issueSet.has('overbroad_prompt') ||
    issueSet.has('too_long_for_task')
  ) {
    reasons.push('It keeps the boundaries tight so the answer stays useful.');
  }

  if (issueSet.has('missing_output_format') || candidate.score_band !== 'Excellent') {
    reasons.push('It spells out the output shape, which makes the result easier to reuse.');
  }

  if (issueSet.has('needs_search')) {
    reasons.push('It asks for sources instead of trusting a guess.');
  }

  if (issueSet.has('needs_tool_use')) {
    reasons.push('It leaves room for the right workflow instead of forcing a pure text answer.');
  }

  if (
    candidate.redaction_placeholder_total > 0 ||
    candidate.safety_rank > 0 ||
    issueSet.has('privacy_risk') ||
    issueSet.has('possible_secret')
  ) {
    reasons.push('It stays safe by keeping sensitive details out of the prompt body.');
  }

  if (issueSet.has('wrong_model_class') || issueSet.has('overpowered_model')) {
    reasons.push('It keeps the model fit realistic for the job.');
  }

  return joinSentences(reasons);
}

function buildCopyPattern(candidate: PromptExampleCandidate): string {
  const parts: string[] = ['Task + context + constraints + output format'];
  const issueSet = new Set(candidate.issue_labels);

  if (issueSet.has('needs_search')) {
    parts.push('add sources when facts matter');
  }

  if (issueSet.has('needs_tool_use')) {
    parts.push('add a tool/workflow step when the answer depends on one');
  }

  if (
    candidate.redaction_placeholder_total > 0 ||
    candidate.safety_rank > 0 ||
    issueSet.has('privacy_risk') ||
    issueSet.has('possible_secret')
  ) {
    parts.push('add a redaction rule before sending anything sensitive');
  }

  if (issueSet.has('wrong_model_class') || issueSet.has('overpowered_model')) {
    parts.push('match the model to the task complexity');
  }

  return `${parts[0]}${parts.length > 1 ? `, ${parts.slice(1).join(', ')}` : ''}.`;
}

function derivePrimaryIssueKey(
  result: PromptResult,
  issueLabels: string[],
  safetyRank: number,
): string {
  const firstIssue = issueLabels[0];
  if (firstIssue) {
    return `issue:${firstIssue}`;
  }

  if (safetyRank > 0) {
    const severity = result.safety_result?.highest_severity ?? 'warning';
    return `safety:${severity}`;
  }

  return `prompt:${result.prompt_log_id}`;
}

function derivePrimaryIssueLabel(
  result: PromptResult,
  issueLabels: string[],
  scoreBand: NonNullable<ReturnType<typeof getScoreBand>>,
  safetyRank: number,
): string {
  const firstIssue = issueLabels[0];
  if (firstIssue) {
    return humanizeIssueLabel(firstIssue);
  }

  if (safetyRank > 0) {
    const severity = result.safety_result?.highest_severity;
    return severity
      ? `${severity[0].toUpperCase()}${severity.slice(1)} safety warning`
      : 'Safety warning';
  }

  return `${scoreBand} prompt`;
}

function getRoastFocusRank(issueLabels: string[], safetyRank: number): number {
  const firstIssue = issueLabels[0];
  if (firstIssue && ROAST_FOCUS_RANK[firstIssue] !== undefined) {
    return ROAST_FOCUS_RANK[firstIssue];
  }

  if (safetyRank > 0) {
    return 1;
  }

  return 0;
}

function getSafetyRank(result: PromptResult): number {
  if (result.do_not_send_external) {
    return SAFETY_SEVERITY_RANK.critical;
  }

  const severity = result.safety_result?.highest_severity;
  if (!severity) {
    return 0;
  }

  return SAFETY_SEVERITY_RANK[severity] ?? 0;
}

function explainWhatWentWrong(candidate: PromptExampleCandidate): string {
  const primaryIssue = candidate.issue_labels[0];
  if (primaryIssue) {
    const note = ISSUE_LABEL_COACHING_NOTES[primaryIssue];
    const label = humanizeIssueLabel(primaryIssue);
    const issueText = note ?? `${label} is the part that needs the most attention.`;

    return `The prompt is mostly tripping over ${label.toLowerCase()}: ${issueText}`;
  }

  if (candidate.safety_rank > 0) {
    return 'The prompt contains sensitive material, so the first fix is to redact it before reuse.';
  }

  return `The prompt is under-specified for a ${candidate.score_band.toLowerCase()}-tier result, so the model had to fill in too much on its own.`;
}

function explainWhyItMatters(candidate: PromptExampleCandidate): string {
  if (candidate.safety_rank > 0) {
    return 'Sensitive data in the prompt breaks the trust boundary before the model even starts answering.';
  }

  switch (candidate.score_band) {
    case 'Poor':
      return 'At this score, the model spends more effort decoding the prompt than solving it.';
    case 'Okay':
      return 'The answer can work, but the missing pieces reliably turn into cleanup work later.';
    case 'Good':
      return 'This is close, but the weak spot still shows up when you reuse the prompt at speed.';
    case 'Excellent':
      return 'The structure is strong; the coach is mostly pointing at polish, not rescue.';
    default:
      return 'The prompt still leaves avoidable work on the table.';
  }
}

function explainHabitToBuild(candidate: PromptExampleCandidate): string {
  const primaryIssue = candidate.issue_labels[0];
  if (primaryIssue) {
    const note = ISSUE_LABEL_COACHING_NOTES[primaryIssue];
    if (note) {
      return note;
    }
  }

  if (candidate.safety_rank > 0) {
    return 'Redact sensitive data first, then reuse the prompt.';
  }

  switch (candidate.score_band) {
    case 'Poor':
      return 'Name the task, the audience, and the success criteria before adding extra detail.';
    case 'Okay':
      return 'Add one missing constraint or example so the model has a cleaner target.';
    case 'Good':
      return 'Trim one remaining source of ambiguity to make the prompt easier to reuse.';
    case 'Excellent':
      return 'Keep the structure and reuse it as a template for the same kind of task.';
    default:
      return 'Make the prompt narrower and more explicit next time.';
  }
}

function trimBlankLines(lines: string[]): string[] {
  const trimmed = [...lines];

  while (trimmed.length > 0 && trimmed[0] === '') {
    trimmed.shift();
  }

  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }

  return trimmed;
}

function joinSentences(parts: string[]): string {
  return parts.join(' ');
}
