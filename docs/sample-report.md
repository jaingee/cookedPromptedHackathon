# Sample cookedPrompts Report

This is a committed sample report generated from the built-in synthetic demo dataset using:

```bash
npm run demo:save
```

It is included so judges can preview the V1 output without running the CLI first.

Privacy note: this sample is generated from synthetic demo data. It may include synthetic or masked prompt excerpts for coaching, but it should not contain raw secrets, full model answers, matched secret values, or banned output fields.

---

## How to read this sample

This sample is meant to show how cookedPrompts turns repeated prompt patterns into coaching signals.

The aggregate sections show what keeps going wrong across the batch. The example sections show the kind of prompt habit that triggered the score, using synthetic or privacy-safe local excerpts rather than full model answers.

Example interpretation:

| Pattern | What it means | Coaching move |
|---|---|---|
| **Missing constraints** | The user asked for help but did not define length, tone, scope, acceptance criteria, or boundaries. | Add constraints such as "keep it under 200 words," "use bullet points," "focus only on implementation risks," or "do not change the public API." |
| **Missing output format** | The user did not tell the model what shape the answer should take. | Ask for a table, checklist, JSON object, code block, step-by-step plan, or final paste-ready draft. |
| **Missing context** | The model was not given enough background, goal, audience, or project state. | Add the relevant situation, constraints, prior decisions, and what "done" should look like. |
| **Wrong model class** | The task used more model capability than needed, or not enough capability for the reasoning required. | Use cheaper or faster models for simple transformations and reserve stronger reasoning models for architecture, debugging, planning, or complex tradeoffs. |
| **Possible secret / privacy risk** | The prompt appeared to contain credential-like or sensitive content. | Replace secrets, customer details, internal URLs, and private data with placeholders before sending anything externally. |

So when the report says "Missing constraints x18," the coaching takeaway is not just that several prompts were weak. The real lesson is that the user repeatedly asks for help without defining the boundaries of a good answer.

That makes the next action clear: improve the habit, not just one prompt.

---

# 20 Prompts Later: Your AI Habits Exposed

Analyzed 20 prompts with a 100% success rate. Prompt Habit Score: 59/100. 3 prompts flagged with safety concerns. Most common issue: Missing constraints. Biggest coaching opportunity: Missing constraints.

## Batch Verdict

You have workable habits, but they leak quality in repeatable ways. Main drag on results: Missing constraints.

- **Total prompts**: 20
- **Succeeded**: 20
- **Failed**: 0
- **Success rate**: 100 %
- **Duration**: 29 ms

- **Score**: 59 / 100
- **Band**: Okay

*This verdict is based on aggregate local scoring across 20 prompts.*

## Prompt Habit Score

You have workable habits, but they leak quality in repeatable ways.

- **Score**: 59 / 100
- **Band**: Okay

## Category Scorecard

Fixed-category scoring so you can spot weak habits quickly.

- **Clarity**: 65 / 100 (Okay)
  - Your prompts could be clearer. State the task in one sentence before adding detail.
- **Context**: 55 / 100 (Okay)
  - Missing context is your biggest gap. Add background, constraints, and audience.
- **Constraints**: 38 / 100 (Poor)
  - Add explicit constraints: length, format, tone, and boundaries help the model focus.
- **Output Format**: 48 / 100 (Poor)
  - Specify the desired output shape upfront. JSON? Bullet list? Code block?
- **Model Fit**: 70 / 100 (Good)
- **Efficiency**: 88 / 100 (Excellent)
- **Safety & Privacy**: 89 / 100 (Excellent)

*Your prompts could be clearer. State the task in one sentence before adding detail.*
*Missing context is your biggest gap. Add background, constraints, and audience.*

## What Kept Hurting Results

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

## Prompt Examples

Redacted local examples from the weakest prompts in this batch, plus stronger rewrite guidance. Sensitive spans are masked before display.

### Example 1 — Missing constraints

**Score:** 20 / 100 — Poor

**Original prompt excerpt**
```text
My password is [REDACTED_PASSWORD] and my database is at db.example.test:5432. Why is my SELECT query timing out?
```

**What went wrong**
The prompt is mostly tripping over missing constraints: Specify length, tone, format, or boundaries.

**Why it matters**
Sensitive data in the prompt breaks the trust boundary before the model even starts answering.

**Habit to build**
Specify length, tone, format, or boundaries.

**A stronger version**
```text
I need help with [task].

Constraints:
- [length, tone, audience, or other limits]
- [must not do or assume]

Output format:
- [exact shape I want back]
- [sections, fields, or structure to preserve]

Model fit:
- Use the smallest model that can still do this job well.
- Explain the tradeoff if the task really needs more reasoning depth.

Safety and privacy:
- Do not include secrets, passwords, tokens, private hostnames, or personal data.
- Replace sensitive details with placeholders before reuse.

Please focus on [success criteria].
```

**Why this works**
It gives the model a clear task. It pins down the boundaries instead of letting the model guess. It tells the model what shape the answer should take. It keeps sensitive data out by telling the model to use placeholders. It matches the task to the right amount of reasoning power.

- **Top issues**: Missing constraints, Missing output format, Possible secret

### Example 2 — Missing context

**Score:** 40 / 100 — Poor

**Original prompt excerpt**
```text
Do the thing from last time
```

**What went wrong**
The prompt is mostly tripping over missing context: Add background, goal, and audience so the model has enough to work with.

**Why it matters**
At this score, the model spends more effort decoding the prompt than solving it.

**Habit to build**
Add background, goal, and audience so the model has enough to work with.

**A stronger version**
```text
I need help with [task].

Context:
- [background the model needs]
- [what I have already tried]
- [who this is for or what success looks like]

Constraints:
- [length, tone, audience, or other limits]
- [must not do or assume]

Output format:
- [exact shape I want back]
- [sections, fields, or structure to preserve]

Please focus on [success criteria].
```

**Why this works**
It gives the model a clear task. It adds the missing context so the answer has a real target. It pins down the boundaries instead of letting the model guess. It tells the model what shape the answer should take.

- **Top issues**: Missing context, Unclear task, Missing constraints

### Example 3 — Missing output format

**Score:** 80 / 100 — Good

**Original prompt excerpt**
```text
Write a project plan for building a todo app. Include tech stack, timeline, milestones, and risks. Target audience: solo developer, 2-week timeline, React + Node stack.
```

**What went wrong**
The prompt is mostly tripping over missing output format: Tell the model what shape the output should be (JSON, list, prose, etc.).

**Why it matters**
This is close, but the weak spot still shows up when you reuse the prompt at speed.

**Habit to build**
Tell the model what shape the output should be (JSON, list, prose, etc.).

**A stronger version**
```text
I need help with [task].

Output format:
- [exact shape I want back]
- [sections, fields, or structure to preserve]

Model fit:
- Use the smallest model that can still do this job well.
- Explain the tradeoff if the task really needs more reasoning depth.

Please focus on [success criteria].
```

**Why this works**
It gives the model a clear task. It tells the model what shape the answer should take. It matches the task to the right amount of reasoning power.

- **Top issues**: Missing output format, Wrong model class

## Roast of the Batch

The weakest lesson in the batch, made memorable without being mean.

> This prompt showed up wearing a name tag and no instructions.

**Prompt excerpt**
```text
Do the thing from last time
```

- **Target issue**: Missing context
- **Why this one hurt**: It leaves missing context unresolved, which makes the answer wobble and creates cleanup work later. Add background, goal, and audience so the model has enough to work with.

## One Good Prompt Worth Copying

The cleanest prompt in the batch, translated into a reusable habit.

- **Score**: 80 / 100
- **Band**: Good

```text
Draft a professional email to a client explaining a 1-week delay. Tone: apologetic but confident. Include a revised timeline. Keep under 150 words.
```

**Why it works**
It names the task clearly without extra noise. It gives the model enough context to stay on target. It spells out the output shape, which makes the result easier to reuse. It stays safe by keeping sensitive details out of the prompt body.

**Pattern to copy**
Task + context + constraints + output format, add a redaction rule before sending anything sensitive.

## Model Waste / Overkill

Model choice should follow the task, not habit.

- **Overkill**: 10
- **Underfit**: 0
- **Coaching**: Several prompts used more model power than they needed; trim the default upward drift.
- Some prompts asked for more model power than the task needed.
- Grounded tasks should still ask for search or tool use when facts or workflows matter.
- Match model power to task risk, uncertainty, and required reasoning depth.
- Wrong model class appeared 10 times; the task may need a different capability class.
- Model recommendations lean toward balanced_general (50%), so check whether that default is doing too much of the work.

## Safety & Privacy

3 prompts flagged with safety warnings.

- **Prompts with warnings**: 3
- **Do not send externally**: 2

- High warnings: 2
- Medium warnings: 1

*Some prompts should not be sent to external models. Review and redact before routing.*

## Safety & Privacy Lessons

Clean the sensitive parts before you reuse or share the prompt.

- **Coaching**: This batch shows both safety warnings and redaction-worthy prompt content, so the safest habit is to clean prompts before reuse or sharing.
- **High safety warnings**: 2 (high)
- **Passwords**: 1 (high)
- **Medium safety warnings**: 1 (medium)
- 2 prompts were flagged as high safety warnings; keep them local until they are cleaned up.
- 1 prompt included passwords; mask this as [REDACTED_PASSWORD] before reuse.
- 1 prompt were flagged as medium safety warnings; keep them local until they are cleaned up.
- 3 prompts had safety warnings; remove sensitive context before sharing outside the batch.
- [REDACTED_PASSWORD] x1
- If redaction still leaves sensitive context, keep the prompt local or rewrite it before sharing.

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

## Top Fixes Checklist

4 prioritized actions to improve your prompt habits.

1. Safety: Review 2 prompts flagged as unsafe for external routing.
2. Issue: Fix "Missing constraints" (appeared 18×): Specify length, tone, format, or boundaries.
3. Issue: Fix "Missing output format" (appeared 12×): Tell the model what shape the output should be (JSON, list, prose, etc.).
4. Prompt health: Improve Constraints: Add explicit constraints: length, format, tone, and boundaries help the model focus.

## Limitations

This report reviews aggregate prompt habits using local rule-based analysis. It is coaching guidance, not a comprehensive human review.

*Scores are heuristic-based and may not capture all nuances of your workflow.*
*Model recommendations reflect general capability classes, not specific provider benchmarks.*
*This report stays local and deterministic. The full 12D report is complete and ready for use.*

---

*Generated at 2026-07-07T17:49:35.780Z by demo-report-renderer-v1.*
