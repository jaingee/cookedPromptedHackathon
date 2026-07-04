# Sample cookedPrompts Report

This is a committed sample report generated from the built-in synthetic demo dataset using:

```bash
npm run demo:save
```

It is included so judges can preview the V1 output without running the CLI first.

Privacy note: this sample is generated from synthetic demo data. It should not contain raw prompt content, full model answers, matched secret values, or banned output fields.

---

## How to read this sample

This report intentionally avoids raw prompt examples.

Instead of showing the user's original prompt text, cookedPrompts summarizes repeated patterns and turns them into coaching signals. This protects privacy while still showing what needs to improve.

Example interpretation:

| Pattern | What it means | Coaching move |
|---|---|---|
| **Missing constraints** | The user asked for help but did not define length, tone, scope, acceptance criteria, or boundaries. | Add constraints such as "keep it under 200 words," "use bullet points," "focus only on implementation risks," or "do not change the public API." |
| **Missing output format** | The user did not tell the model what shape the answer should take. | Ask for a table, checklist, JSON object, code block, step-by-step plan, or final paste-ready draft. |
| **Missing context** | The model was not given enough background, goal, audience, or project state. | Add the relevant situation, constraints, prior decisions, and what "done" should look like. |
| **Wrong model class** | The task used more model capability than needed, or not enough capability for the reasoning required. | Use cheaper/faster models for simple transformations and reserve stronger reasoning models for architecture, debugging, planning, or complex tradeoffs. |
| **Possible secret / privacy risk** | The prompt appeared to contain credential-like or sensitive content. | Replace secrets, customer details, internal URLs, and private data with placeholders before sending anything externally. |

So when the report says "Missing constraints x18," the coaching takeaway is not "these 18 prompts were bad." The takeaway is:

> "This user repeatedly asks for help without defining the boundaries of a good answer."

That makes the next action clear: improve the prompt habit, not just one prompt.

---

# 20 Prompts Later: Your AI Habits Exposed

Analyzed 20 prompts with a 100% success rate. Average prompt score: 2.95/5. 3 prompts flagged with safety concerns. Most common issue: Missing constraints. Biggest coaching opportunity: Missing constraints.

## Batch Overview

Analyzed 20 prompts with a 100% success rate.

- **Total prompts**: 20
- **Succeeded**: 20
- **Failed**: 0
- **Success rate**: 100 %
- **Average score**: 2.95 / 5
- **Duration**: 25 ms

## Prompt Health

Dimensions ranked from weakest to strongest.

- Constraints: 1.9 / 5
- Output Format: 2.4 / 5
- Context & Background: 2.75 / 5
- Clarity: 3.25 / 5
- Capability Fit: 3.5 / 5
- Efficiency: 4.4 / 5
- Safety & Privacy: 4.45 / 5

*Add explicit constraints: length, format, tone, and boundaries help the model focus.*
*Specify the desired output shape upfront. JSON? Bullet list? Code block?*

## Issue Patterns

Found 8 recurring issue patterns.

- Missing constraints (×18)
- Missing output format (×12)
- Wrong model class (×10)
- Missing context (×9)
- Unclear task (×7)
- Overbroad prompt (×2)
- Possible secret (×2)
- Privacy risk (×1)

*Specify length, tone, format, or boundaries.*
*Tell the model what shape the output should be (JSON, list, prose, etc.).*
*Match the task to the right model capability class.*
*Add background, goal, and audience so the model has enough to work with.*
*State the objective in one sentence. What does "done" look like?*
*Break this into smaller focused sub-tasks.*
*Never paste secrets. Use placeholder references instead.*
*Remove or redact sensitive data before sending externally.*

## Safety & Privacy

3 prompts flagged with safety warnings.

- **Prompts with warnings**: 3
- **Do not send externally**: 2

- high: 2
- medium: 1

*Some prompts should not be sent to external models. Review and redact before routing.*

## Model Recommendations

Model class distribution across 20 recommendations.

- balanced_general: 10 (50%)
- coding_specialist: 6 (30%)
- do_not_send_external: 2 (10%)
- frontier_reasoning: 1 (5%)
- local_or_open_weight: 1 (5%)

## Rewrite & Template Coaching

20 prompts received rewrite suggestions.

- Rewrite severity "medium": 9
- Rewrite severity "high": 8
- Rewrite severity "critical": 2
- Rewrite severity "low": 1
- Template "Constrained Prompt": suggested 12 times
- Template "Context + Output Structure": suggested 10 times
- Template "Context-Rich Prompt": suggested 9 times
- Template "Clear Task Prompt": suggested 6 times
- Template "Model-Appropriate Prompt": suggested 6 times

## Next Actions

4 prioritized actions to improve your prompt habits.

1. Safety: Review 2 prompts flagged as unsafe for external routing.
2. Issue: Fix "Missing constraints" (appeared 18×): Specify length, tone, format, or boundaries.
3. Issue: Fix "Missing output format" (appeared 12×): Tell the model what shape the output should be (JSON, list, prose, etc.).
4. Prompt health: Improve Constraints: Add explicit constraints: length, format, tone, and boundaries help the model focus.

## Limitations

This report reviews aggregate prompt habits using local rule-based analysis. It is coaching guidance, not a comprehensive human review.

*Scores are heuristic-based and may not capture all nuances of your workflow.*
*Model recommendations reflect general capability classes, not specific provider benchmarks.*
*No raw prompt content is included in this report. CLI and export packaging are handled separately.*

---

*Generated at 2026-07-04T21:41:24.377Z by demo-report-renderer-v1.*
