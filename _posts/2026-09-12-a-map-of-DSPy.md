# 1. What is DSPy

## 1.1 The problem DSPy solves

Most prompt engineering work looks the same regardless of the task. Someone writes a long string of instructions, runs it against a model, reads the output, and edits the string. The string keeps growing. Formatting instructions pile on top of task instructions, examples get pasted in by hand, and after a few rounds nobody can say which sentence in the prompt is doing what. If the underlying model changes, or the task shifts slightly, the whole thing has to be re-tuned by hand again, usually by trial and error.

This works, but it does not scale, and it does not compose well. A pipeline that chains several LLM calls together, a retriever feeding a reasoner feeding a formatter, for example, multiplies the problem. Each stage has its own hand-tuned prompt, and a change in one stage's output can silently break the prompt written for the next one. There is no clean way to reuse a stage in a different pipeline, and no systematic way to ask what the best prompt for a given stage would be, given how it is actually being used downstream.

DSPy starts from a different premise. Instead of writing a prompt as a fixed string, you write a program that declares what each step should take as input and produce as output, and you separate that declaration from the actual wording of the instructions sent to the model. The wording becomes something the system can search over and improve, instead of something a person has to guess at by hand. The name is a contraction of "declarative self-improving language programs." The programs are declarative, meaning you say what you want rather than write out the exact phrasing needed to get it. And they are self improving, meaning a separate optimization step tunes the actual prompt text, the few-shot examples, or the model's instructions, using data and a metric you supply.

## 1.2 Programs as the core abstraction

The shift DSPy asks for is easiest to see by contrast. In a typical prompting workflow, the unit of work is a string, the prompt itself. You experiment with a string, keep the one that works, and paste it into your code. In DSPy, the unit of work is a program built out of small, typed components that call a language model. The program specifies the shape of each step, what goes in and what comes out, without hardcoding the exact wording that gets sent to the model to produce that output.

This is a familiar move in software design, applied here to language models. A regular Python function has a signature (its parameters and return type) and a body (the logic that computes the return value from the parameters). Traditional prompting collapses these into one string, so the signature and the instructions for computing it cannot be changed independently. DSPy pulls them apart. The signature says what a step does.

A separate mechanism, the optimizer, decides how to phrase the actual request to the model so the step does that reliably. Because the two pieces are separated, you can change the phrasing, or let an algorithm search for a better one, without touching the code that defines what the step is supposed to do. You can also swap the underlying model and rerun the same search, without starting the tuning process over by hand.

Four pieces make this work, and the rest of this section walks through each one in order. A signature describes a step's input and output. A module turns a signature into an actual prompting strategy, whether that is a direct request or a request that includes reasoning. A metric defines what counts as a good output for the task at hand. An optimizer uses the metric and a small set of training examples to search for better prompts, better few-shot demonstrations, or both.

A DSPy program is built from signatures and modules. A DSPy optimizer is what improves that program once you have data and a way to judge quality.

## 1.3 Signatures declare input and output behavior

A signature declares what a step in your pipeline consumes and what it should produce. It says nothing about phrasing. A step that reads a piece of text and decides its sentiment has a signature that says the step takes text in and returns a sentiment label, and stops there. It does not say the model should act as a helpful assistant, and it does not specify how the label should be worded in the request sent to the model. That part is handled elsewhere.

The simplest way to write a signature is as a short string, with text going in and a named field coming out, for example. This inline form is convenient for quick, single-purpose steps, and it works because DSPy parses the string into named input and output fields on your behalf.

For anything beyond a trivial step, a class-based signature is the more common and more powerful form. It is written as a Python class with a docstring describing the task, and with fields marked as inputs or outputs, each carrying a type and a short description. The docstring becomes part of what an optimizer can later see and refine. The field descriptions tell the model, and a human reading the code, what each piece of information means. A field can be typed as plain text, as a boolean, as one of a fixed set of choices, or as a structured object, and DSPy enforces that the model's output actually conforms to the declared type, retrying or reformatting as needed rather than leaving you to parse free text yourself. A classification signature, as a generic example, might declare a text input field and an output field typed as one of a small set of category labels. A summarization signature might declare a long document as input and a short summary as output, with a separate field for a target length.

Two things about signatures matter for everything that follows. First, the type information is not decorative. Declaring an output field as a boolean or as one of a fixed set of labels changes how DSPy formats the underlying request and how it parses the response, which changes how reliable the step turns out to be in practice. Loosely typed signatures push more of the interpretation burden onto your own code afterward. Tightly typed signatures push more of that burden onto DSPy itself. Second, everything written into a signature, the docstring, the field names, the field descriptions, is text an optimizer is free to rewrite later, within limits, when it searches for a better version of the prompt. Writing a signature is writing a specification that a prompt will eventually be generated to satisfy, not a final prompt.

## 1.4 Modules turn a signature into behavior

A signature says what a step does. A module says how the step actually asks the model to do it. This is the layer where DSPy turns a declaration into an executable prompting strategy, and different modules implement different strategies around the same signature.

The most basic module, Predict, takes a signature and issues a single, direct request to the model, given these inputs, produce these outputs. There is no intermediate reasoning step built into the prompt. This is a reasonable choice for tasks where the mapping from input to output is close to immediate for a competent model, such as straightforward classification or short-form extraction, and it is also the cheapest and fastest option, since it produces only the requested output fields and nothing else.

ChainOfThought wraps the same signature but inserts an additional field before the declared outputs, instructing the model to reason step by step and write that reasoning out before committing to an answer. This tends to help on tasks where the correct output depends on working through several pieces of information or a chain of implications, because forcing the model to write intermediate reasoning reduces the chance that it jumps to an answer prematurely. The cost is real. More tokens get generated per call, so latency and expense both go up, in exchange for often meaningfully better accuracy on tasks that benefit from the extra reasoning. On tasks that do not need it, ChainOfThought tends to add cost without adding accuracy, and can occasionally make a model talk itself out of an otherwise correct answer.

Beyond these two, DSPy ships other modules built around different interaction patterns. ReAct interleaves reasoning with tool calls, letting a model decide to look something up or run a calculation partway through solving a problem before producing a final answer. ProgramOfThought asks the model to produce and execute code as part of reaching an answer, which suits tasks that are naturally computational. These are worth knowing exist, but Predict and ChainOfThought cover the large majority of everyday steps, and choosing between the two is usually the first real design decision in building a DSPy program.

Modules compose. A single module wrapping a single signature is a complete DSPy program on its own, but most real pipelines need more than one step, retrieving something, then reasoning over it, then formatting the answer, as one common pattern. DSPy handles this the way ordinary software handles composition. You write a Python class that subclasses the base module type, create the submodules you need as attributes in its constructor, and define a forward method that calls them in sequence, passing the output of one step as the input to the next. From the outside, this composed class behaves like any other module. It can be called directly, and, importantly, it can be compiled by an optimizer as a whole, so the optimization step is not limited to tuning one call in isolation but can consider how the steps work together.

## 1.5 Metrics define what counts as good

A metric is a function that looks at an example, the output your program produced for it, and returns a judgment of quality. It plays two roles at once. During evaluation, it is simply how you measure whether your program is doing well. During optimization, it is the signal an optimizer uses to decide whether one candidate version of a prompt beats another, so the metric is effectively defining the objective the whole optimization process is chasing.

The simplest metrics are ones you already know from standard machine learning evaluation. Exact match between a predicted label and a ground-truth label. F1 score for token overlap in a generated answer. Accuracy over a labeled test set. These work well whenever there is a clear, checkable ground truth. Where the task is more open ended, such as judging whether a generated explanation is coherent or whether a summary preserves the facts of a source document, a common approach is to make the metric itself another call to a language model, a separate, usually simpler DSPy program whose job is to look at the output and score it against a rubric. Making the LLM the judge lets you optimize for qualities that are hard to check with a formula, at the cost of making the metric itself a component that can be wrong or inconsistent, worth keeping in mind when results look surprising.

One detail is specific to how DSPy uses metrics during optimization. A metric function can accept an optional argument carrying the full execution trace of a run, not just its final output. Many optimizers work by generating candidate few-shot examples through a process called bootstrapping, running the program on training inputs and keeping the runs that produced a good result, according to the metric, as demonstrations for future prompts. A metric that inspects the trace can apply a stricter or more detailed check during this bootstrapping process than it applies during ordinary evaluation, because more information is available during bootstrapping about how an answer was reached, not just what the final answer was. This is a niche detail early on, but it explains a pattern that shows up in more advanced DSPy code, a metric function with a branch that behaves differently depending on whether a trace was passed in.

## 1.6 The optimizer concept

Everything covered so far describes how to define a DSPy program and how to judge its output. None of it, by itself, produces a good prompt because that is the job for the optimizer, and it is the piece that gives DSPy its self-improving half.

An optimizer takes three things: The program you have written. A set of training examples, typically just inputs, sometimes with expected outputs attached. And the metric. It then searches for a better version of the program, where better means a version whose modules produce prompts that score higher on the metric across the training examples. What gets searched over depends on the specific optimizer. Some search over which few-shot examples to attach to a prompt. Some search over the phrasing of the instructions themselves. Some search over both together. The search is not something you write by hand. You configure the optimizer, hand it the program, the data, and the metric, and let it run.

This is a different way of arriving at a prompt than writing one yourself and iterating manually. Manual prompt writing is guided by intuition about what a model responds well to. Optimization is guided by a measured score on real examples, and it can explore combinations of phrasing and demonstrations that would be tedious or nonobvious to try by hand. The quality of the result still depends on having a metric that actually reflects what you care about, and training examples that represent the task well. A full account of how the different optimizers work, and how to choose between them, is the subject of the next section.

## 1.7 What compiling actually does

Compiling is the step where an optimizer is applied to a program, and the term is a deliberate echo of software compilation. You hand over a higher-level description, the program as written, and get back a lower level, executable artifact, the same program with its prompts filled in and tuned, without having written that artifact directly.

Concretely, a compile call takes your program, a training set, and a metric. The metric is often attached to the optimizer itself when it is configured, instead of being passed at this exact call, but conceptually it belongs to the same package. What happens next depends on the optimizer, but the general shape is shared across most of them. The optimizer runs your program, or pieces of it, against examples from the training set. It observes the inputs, the outputs, and, where relevant, the full trace of each run, and uses the metric to score how well each run did. It uses those scores to propose changes, generating new candidate versions of the prompt, different few-shot examples, different phrasing of the instructions, or both, and evaluates those candidates the same way. At the end, it returns a new version of your program, structurally identical to the one you wrote, same signatures, same module composition, but with the modules now carrying an optimized configuration. That configuration might be a specific set of few-shot demonstrations, or refined instructions, or both, depending on what the optimizer was designed to search over.

Compiling does not change what your program computes conceptually. It changes how the underlying calls to the model are phrased and supported, so the same declared task is performed more reliably. A compiled program can be used exactly like the original and called the same way, but it will typically perform better on your metric, sometimes substantially so, because the tuning was driven by measured feedback rather than by guesswork. A compiled program can also be saved to disk as a file, and loaded back later without repeating the search. This matters in practice, because compiling can be slow and can use a meaningful number of model calls.

## 1.8 A minimal end-to-end example

The pieces read differently in isolation than they do assembled into a working program. Take a small, generic task, deciding whether a short piece of customer feedback expresses a complaint or not. First, the signature declares the shape of the step.

```python

import dspy

class ClassifyFeedback(dspy.Signature):

"""Decide whether a piece of customer feedback is a complaint."""

feedback: str = dspy.InputField()

is_complaint: bool = dspy.OutputField()

```

Next, a module turns that signature into a callable step. Since this is a fairly direct judgment, Predict is a reasonable starting choice.

```python

classify = dspy.Predict(ClassifyFeedback)

result = classify(feedback="The delivery was three days late and no one answered support calls.")

print(result.is_complaint)

```

At this point the program works, but its prompt is whatever DSPy generates by default from the signature, unassisted by any examples or tuning. Improving it takes a metric and a small labeled training set.

```python

def accuracy(example, prediction, trace=None):

return example.is_complaint == prediction.is_complaint

trainset = [

dspy.Example(feedback="Great service, thank you!", is_complaint=False).with_inputs("feedback"),

dspy.Example(feedback="This is the second time my order arrived broken.", is_complaint=True).with_inputs("feedback"),

# a handful more labeled examples, in practice

]

```

Finally, an optimizer is configured with that metric and used to compile the program against the training set.

```python

from dspy.teleprompt import BootstrapFewShot

optimizer = BootstrapFewShot(metric=accuracy)

compiled_classify = optimizer.compile(classify, trainset=trainset)

```

The result, compiled_classify, is called exactly like the original module, but it now carries few-shot demonstrations chosen because they helped the program reach the right answer on the training data, according to the metric. Everything covered in this section is present in this small example. A signature says what the step does. A module decides how the request is phrased. A metric defines success. An optimizer uses the metric and a training set to improve the module through compiling. The next section covers what happens inside that last step in real detail, across the different optimizers DSPy provides.

## Further reading

- DSPy official documentation: [dspy.ai](https://dspy.ai/)
    
- Signatures, in depth: [dspy.ai/learn/programming/signatures](https://dspy.ai/learn/programming/signatures/) and [dspy.ai/diving-deeper/signatures-in-depth](https://dspy.ai/diving-deeper/signatures-in-depth/)
    
- Modules documentation, including Predict and ChainOfThought: [github.com/stanfordnlp/dspy/docs/docs/learn/programming/modules.md](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/learn/programming/modules.md)
    
- Khattab, O. et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines," arXiv:2310.03714: [arxiv.org/abs/2310.03714](https://arxiv.org/abs/2310.03714)
    
- DSPy source repository: [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)
    

# 2. Prompt Optimizers Survey

## 2.1 What an optimizer actually searches over

Every optimizer covered in this section takes the same three inputs, a program, a training set, and a metric, and returns the same kind of output, a version of that program with better prompts. What differs between them is what they search over to get there, and how they search.

There are two things an optimizer can change about a module's prompt. It can choose which few-shot demonstrations to attach, examples of the task being done correctly, pulled from the training data or generated by running the program itself. Or it can change the instruction text, the docstring and field descriptions that make up the signature, rewriting them into something that gets better results from the model. Some optimizers touch only one of these. Others touch both at once, and search over combinations of the two.

A term that comes up across almost every optimizer is bootstrapping. It refers to a specific technique for generating demonstrations without a human having to write them out. The optimizer runs the program, or the module being optimized, on inputs from the training set. Wherever the metric judges the output good enough, the full input and output pair is kept as a demonstration, sometimes along with the reasoning trace that produced it. The program effectively generates its own training examples by attempting the task and keeping the attempts that worked. This matters because in real projects you often have plenty of unlabeled or lightly labeled inputs but very few fully worked examples someone has written by hand. Bootstrapping turns the first into a version of the second.

The rest of this section works through five optimizers in increasing order of what they search over and how much machinery they bring to the search.

## 2.2 BootstrapFewShot

BootstrapFewShot is the most direct implementation of the bootstrapping idea described above, and the simplest optimizer in DSPy's toolkit. Given a program, a training set, and a metric, it runs the program on training examples, keeps the runs that pass the metric, and attaches the resulting input-output pairs to the module as few-shot demonstrations. Two settings control how much it collects: a maximum number of bootstrapped demonstrations built this way, and a maximum number of demonstrations taken directly from labeled training examples without running the program at all. Both are usually kept small, often in the single digits, since a longer prompt costs more per call and does not reliably help past a certain point.

The instruction text itself is left untouched. BootstrapFewShot only ever changes which examples accompany a prompt, never the wording of the task description surrounding them. This is both its main limitation and part of why it is a reasonable first optimizer to reach for. It needs comparatively few training examples to produce a useful result, it runs quickly because it makes a single pass of bootstrapping instead of searching over many candidates, and it gives a clear, interpretable improvement over an uncompiled program. The task description stays exactly the same. it is now backed by real worked examples instead of none.

## 2.3 BootstrapFewShotWithRandomSearch

BootstrapFewShotWithRandomSearch builds directly on top of BootstrapFewShot, without introducing a new idea underneath it. Where BootstrapFewShot produces one set of demonstrations and stops, this optimizer produces several candidate sets, evaluates each of them on a held-out validation split, and keeps whichever set actually scored highest. The number of candidates to try is a configurable setting, and each candidate is generated the same way BootstrapFewShot generates its one set, by bootstrapping from the training data, just with different random sampling each time.

The "random search" in the name describes exactly this. The optimizer does not commit to the first bootstrapped set of demonstrations. It tries a handful of different ones and picks the winner by measured performance on the validation split. This costs more, since a full bootstrap-and-evaluate cycle now happens for every candidate, but it tends to produce a more reliable result than a single bootstrap pass, especially on tasks where which specific examples end up in the prompt makes a real difference to accuracy. As a rule of thumb, this optimizer is worth the extra compute once you have a working baseline from plain BootstrapFewShot and want to squeeze out a further improvement without touching instruction text, or when there is a validation set large enough to make the comparison between candidates meaningful.

## 2.4 COPRO

COPRO takes a different axis entirely. Instead of choosing demonstrations, it rewrites the instruction text itself, the docstring and field descriptions in a signature, and leaves demonstration selection out of the picture. The name stands for coordinate prompt optimization, and it works the way coordinate ascent works in general optimization: improve one thing at a time, holding everything else fixed, and repeat.

Concretely, COPRO asks a language model to propose several alternative instructions for a given step, evaluates each proposal against the training set using the metric, keeps the best-performing ones, and then asks for a new round of proposals that build on what worked. Across several rounds this steadily pushes the instruction text toward wording that the metric rewards, without ever needing labeled demonstrations at all. Two settings shape the search: how many candidate instructions get generated at each round, and how many rounds the search runs for. A wider search per round explores more alternatives before narrowing down; more rounds lets good wording get refined further over time.

COPRO is a reasonable choice specifically when the instruction wording is suspected to be the bottleneck and the lack of examples is not, for instance when a task is described adequately but the model keeps misreading what is being asked of it. It is also useful when demonstrations are undesirable for the task, such as when longer prompts are costly at the scale the program will run at, or when good few-shot examples are hard to construct. Its narrower scope (instructions only) makes it a lighter and more targeted tool than the optimizers that search over both instructions and demonstrations together.

## 2.5 MIPROv2

MIPROv2 searches over both instructions and demonstrations at once, and it is the most involved optimizer covered in the project. The name stands for multi-prompt instruction proposal optimizer, and the "v2" reflects a second, more capable version of an earlier approach. It is the optimizer most often recommended in DSPy's own documentation as a strong general-purpose default once a project has moved past initial prototyping.

Its search happens in three stages. The first stage bootstraps demonstration candidates, largely the same way BootstrapFewShot does, running the program and collecting worked examples that pass the metric. The second stage is where MIPROv2 differs sharply from COPRO's approach to instruction generation. It does not ask a model to propose instructions in isolation. It feeds the instruction-proposing model a grounded view of the actual program: a summary of the dataset, a look at the specific bootstrapped demonstrations already collected, and information about the structure of the pipeline the instruction sits inside. This grounding tends to produce instructions that fit the task and the surrounding pipeline more precisely than instructions generated without that context. The third stage searches jointly over the space of instruction and demonstration combinations, since a good instruction and a good demonstration set are not independent choices, a demonstration set can make an instruction redundant or a wording choice can make certain demonstrations more or less useful. MIPROv2 does not try every combination. It uses Bayesian optimization, evaluating candidate combinations on small minibatches of training data and using the results to guide which combinations to try next, converging toward a strong pairing without an exhaustive search.

In practice, this whole process is exposed through a small number of preset budget levels, commonly described as light, medium, and heavy, that trade search thoroughness against the number of model calls the optimization itself will consume.

MIPROv2 is the right choice when the program is a multi stage pipeline where instructions and demonstrations genuinely interact, when there is enough compute budget to afford a real search instead of a single pass, and when squeezing out the last meaningful gain in accuracy matters more than optimization speed.

## 2.6 GEPA

GEPA departs from the search strategy every other optimizer in this section uses. BootstrapFewShot, its random-search variant, COPRO, and MIPROv2 all lean on a numeric score from the metric to decide which candidate is better. GEPA is built around a different kind of signal. It runs on natural-language feedback about why a particular attempt succeeded or failed, a richer signal than a bare pass or fail judgment.

The mechanism is reflective. After running the program on a batch of examples, GEPA collects the full execution traces, including intermediate reasoning and any errors, and has a language model read through them and articulate, in plain language, what went wrong or what could be improved. That reflection is then used to propose a revised instruction directly, informed by an actual diagnosis of the failure and not a blind rewording attempt. This is the reflective half of the approach.

The other half, genetic-pareto, comes from how GEPA manages the population of candidates it is evolving. It does not keep a single best-so-far prompt. It maintains a pool of candidates that are pareto-optimal, meaning none of them is strictly worse than another across every example in the evaluation set. A prompt that is best on one slice of the data and weaker on another is often still worth keeping, since discarding it in favor of a single aggregate winner would throw away a strength that shows up only on part of the data. New candidates are produced by mutating promising instructions based on reflection, and, in later variants of the method, by merging traits from two strong candidates the way genetic algorithms combine parents to produce offspring.

The practical consequence is that GEPA can make meaningful progress with far fewer evaluated rollouts than a search process driven purely by numeric scores, because each reflection extracts more usable information out of a single failure than a bare pass or fail score would. This makes it attractive when the metric can be paired with a way of surfacing rich, inspectable feedback about a run, things like error messages, judge rationales, or intermediate reasoning, and not only a final score, and when the number of examples or the compute budget available for evaluation is genuinely limited. Where MIPROv2's strength comes from a thorough, well-grounded search over a joint space, GEPA's comes from making every individual evaluation count for more.

## 2.7 Comparing the five

| Optimizer                        | Searches over                                          | Relative cost                               | Data needed                                 | Feedback used                           |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------- | --------------------------------------- |
| BootstrapFewShot                 | demonstrations only                                    | low                                         | small training set                          | pass or fail from the metric            |
| BootstrapFewShotWithRandomSearch | demonstrations only, multiple candidates               | moderate                                    | small training set, plus a validation split | numeric score, to rank candidates       |
| COPRO                            | instructions only                                      | moderate                                    | can work with little or no labeled data     | numeric score, across search rounds     |
| MIPROv2                          | instructions and demonstrations jointly                | high                                        | moderate to large training set              | numeric score, guiding Bayesian search  |
| GEPA                             | instructions, via reflection, plus candidate evolution | variable, often lower in evaluated rollouts | works with limited examples                 | rich text feedback, beyond a bare score |

A way to decide is to start from what is actually limiting the current prompt. If the task is well described but the model has no examples to anchor its output format or style, BootstrapFewShot is the fastest way to check whether demonstrations alone close the gap. If that already helps but the result still feels unstable across runs, the random-search variant is a low-effort next step, since it reuses the same mechanism and only adds a selection step on top. If demonstrations are not the issue and the instructions themselves seem to be misleading the model, or examples are impractical to use, COPRO targets that directly. Once a program has multiple interacting stages, or a first pass with the lighter optimizers has plateaued, MIPROv2 is the standard escalation, provided the compute budget for a real search is available. GEPA is worth reaching for specifically when the metric can produce a diagnosis, something a person or a judge model can explain in words, and when the number of examples on hand is too small for the heavier, purely score-driven search that MIPROv2 relies on to work well.

It is common, and often reported as good practice, to run a lighter optimizer first to establish a working baseline before spending the extra compute a heavier one requires, and to switch strategies if a task's bottleneck turns out to be something other than what was first assumed.

## Further reading

- DSPy optimizers overview: [github.com/stanfordnlp/dspy/docs/docs/learn/optimization/optimizers.md](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/learn/optimization/optimizers.md)
    
- Choosing an optimizer, official guidance: [dspy.ai/diving-deeper/choosing-an-optimizer](https://dspy.ai/diving-deeper/choosing-an-optimizer/)
    
- Opsahl-Ong, K. et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs" (the MIPROv2 paper), arXiv:2406.11695: [arxiv.org/abs/2406.11695](https://arxiv.org/abs/2406.11695)
    
- Agrawal, L. et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning," arXiv:2507.19457: [arxiv.org/abs/2507.19457](https://arxiv.org/abs/2507.19457)
    
- GEPA overview in the DSPy documentation: [dspy.ai/api/optimizers/GEPA/overview](https://dspy.ai/api/optimizers/GEPA/overview/)
    
- GEPA reference implementation: [github.com/gepa-ai/gepa](https://github.com/gepa-ai/gepa)
    

# 3. Literature Review

## 3.1 Scope and method

This review covers 23 papers spanning three overlapping areas: automatic prompt optimization as a general technique, multi-agent system design and failure analysis, and agentic systems applied specifically to software engineering tasks.

The sections below group the papers by theme, since the useful structure here is conceptual lineage and disagreement between methods, and a chronological listing would obscure both.

Two papers, both themselves surveys of automatic prompt optimization, are used throughout as organizing references because their contribution is a taxonomy of the field rather than a new method of their own.

## 3.2 The lineage of automatic prompt optimization

The earliest idea in this set treats prompt editing as something closer to gradient descent than to trial and error. [ProTeGi](https://arxiv.org/abs/2305.03495) (Pryzant et al., 2023) runs a prompt on a batch of examples, collects the errors, and asks a model to explain in natural language what about the wording caused those specific mistakes. That explanation is treated as a textual gradient, and candidate edits are generated in the direction the criticism points, with beam search keeping the strongest candidates across iterations. The result, on the benchmarks tested, was an improvement of up to 31% over the starting prompt.

[OPRO](https://arxiv.org/abs/2309.03409) (Yang et al., 2023) takes a different position on the same problem. It shows a model a running list of previously tried prompts alongside the numeric score each one achieved, and asks for a new prompt intended to beat everything on the list. No natural-language criticism enters the process. The model works purely from the score trajectory. One of the phrasings OPRO discovered on its own, an instruction to "take a deep breath and work on this problem step by step," became widely reused afterward, and it did not appear in any of the method's seed prompts. OPRO is useful here as a clean baseline for what score-only search can achieve without any explanation of failure, a comparison point the later reflection-based methods are implicitly built against.

[PromptBreeder](https://arxiv.org/abs/2309.16797) (Fernando et al., 2023) approaches optimization as evolution. It evolves two populations at once, the task prompts themselves, and the mutation prompts that describe how those task prompts should be changed. The mutation strategy is itself a prompt subject to evolution, which makes the method self-referential, and it outperformed established prompting strategies, including chain-of-thought, on the reasoning benchmarks it was tested against.

[TextGrad](https://arxiv.org/abs/2406.07496) (Yuksekgonul et al., 2024) generalizes ProTeGi's textual gradient from a single prompt to an entire pipeline of connected calls, in a structure modeled explicitly on automatic differentiation. An error computed at the end of a pipeline is propagated backward through each earlier call, with each step revised according to the portion of the criticism relevant to it. Tested on question answering with GPT-4o, it raised accuracy from 51 to 55 percent, and the same backpropagation-style approach carried over to domains well outside typical NLP benchmarks, including medical question answering and image generation.

[GEPA](https://arxiv.org/abs/2507.19457) (Agrawal et al., 2025) combines three mechanisms. Genetic evolution treats prompts as a population and produces new candidates by mutation and recombination. Natural-language reflection has the system explain, after each trial, why a given attempt failed, and that explanation feeds directly into the next candidate. Pareto selection keeps several candidates that are each strong on different examples, instead of collapsing early to a single aggregate winner. Across four benchmarks, testing retrieval reasoning, formatting compliance, privacy-preserving answering, and multi-source evidence synthesis, GEPA outperformed a purely score-driven Bayesian optimizer by 10 to 14 percent on average, and matched or beat a reinforcement-learning baseline while using dramatically fewer rollouts: 678 against 24,000 on one of the four tasks.

A related question is how a prompt is worded and, separately, what higher-level pattern it follows: zero-shot, chain-of-thought, ReAct, and similar. [AutoPDL](https://arxiv.org/abs/2504.04365) (2025) searches over the prompting pattern and its content jointly, instead of fixing the pattern by hand and tuning wording inside it. Across seven models ranging from 3 billion to 70 billion parameters, this joint search produced an average improvement of 9 to 15 points over hand-picked pattern and wording, a gain that held even for the smaller models tested.

ProTeGi, OPRO, TextGrad, and PromptBreeder were each originally reported against their own separately chosen baselines, which made comparing them directly difficult. [MemAPO](https://arxiv.org/abs/2603.21520) (2026) ran all four under one controlled setup and reported them side by side. Its own contribution, a memory mechanism that reuses lessons learned from past optimization runs on new tasks instead of starting cold every time, matters independently of the comparison, since none of the four earlier methods carry anything forward between one optimization run and the next.

## 3.3 Multi-agent systems as a search problem

A separate line of work treats the architecture surrounding a prompt, not only its wording, as something that can be searched over. [AgentSquare](https://arxiv.org/abs/2410.06153) (2024) frames agent design as a modular space, treating planning, memory, tool use, and reasoning style as separate, swappable components, and searching automatically over combinations of them instead of requiring a person to hand-assemble an agent for each new task.

A closely related [paper on multi-agent design](https://arxiv.org/abs/2502.02533) (2025) makes a more specific claim: searching over topology, meaning which agents are connected to which and in what order, together with the prompts each agent uses, outperforms optimizing prompts alone on a topology chosen and fixed by hand. Topology is not a background detail in this account. It measurably changes what a good prompt for a given agent even looks like.

[MARS](https://arxiv.org/abs/2503.16874) (2025) applies a similar principle to the optimization process itself. Instead of a single agent proposing candidate prompts alone, one agent proposes and a second, playing a Socratic role, questions the proposal for weaknesses or untested assumptions before the proposer revises. The paper reports that this back-and-forth surfaces problems a lone optimizing agent tends to miss, since nothing internally challenges its own suggestions.

[Connecting the Dots](https://arxiv.org/abs/2505.10936) (2025) turns attention to the handoff points between agents. Its central argument is that how one agent's output is structured for the next agent to consume matters as much as what either agent says on its own, and a well-optimized individual agent can still produce a handoff the next agent struggles to use well. The paper reports that structuring the handoff itself, alongside each agent's individual instructions, measurably improves how downstream agents use what they receive.

[MAPRO](https://arxiv.org/abs/2510.07475) (2025) reframes multi-agent prompt optimization in more formal terms, as a maximum a posteriori inference problem, a standard statistical estimation framing, instead of a black-box trial-and-error search. Under this framing, optimizing the information that flows between agents becomes a defined statistical estimation problem. The paper leans more toward establishing this framework than toward reporting large empirical gains over existing ad hoc methods, but it supplies vocabulary the more empirical papers in this space tend to lack.

[MASPO](https://arxiv.org/abs/2605.06623) (2026) tests a specific consequence of treating agents as interdependent. It optimizes every agent in a system jointly, so that a candidate prompt for one agent is scored partly by how well the agents downstream of it perform as a result, and not by that agent's own output alone. Across six tasks, MASPO's joint optimization outperformed independent, per-agent optimization by an average of 2.9 points, evidence that ignoring downstream effects during optimization leaves measurable performance on the table.

A companion concern is how credit for a good or bad outcome gets assigned when a multi-agent system runs over several rounds. The [credit-assignment paper](https://arxiv.org/abs/2605.30227) (2026) separates two questions usually left tangled together: which round of an interaction contributed most to the final outcome, and which agent within that round was actually responsible. Untangling the two, the paper argues, gives the optimizer a less noisy signal to work from than scoring the entire multi-turn interaction as one undifferentiated unit.

[MAS-PromptBench](https://arxiv.org/abs/2606.23664) (2026) asks the design question most directly: does prompt optimization reliably help multi-agent systems, and how much does the answer depend on how the system is built. It varies four dimensions independently, task, workflow topology, communication protocol, and team size, across nine tasks in three real multi-agent frameworks. The average gain from optimization varies substantially by configuration, from close to zero in some settings to 18 to 24 points in specific sequential configurations on coding tasks. That variance is itself the paper's main finding: whether optimization helps a multi-agent system is not a fixed property of the technique, it depends heavily on how the system around it is built. Every configuration in this benchmark optimizes each agent separately and in sequence. Joint optimization across agents is not among the conditions tested.

## 3.4 Why multi-agent systems fail

A different cluster of papers steps back from proposing new optimization methods and asks instead why multi-agent systems, optimized or not, tend to underperform expectations. [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) (2025) argues that failures are usually treated as one-off bugs when they in fact cluster into a small number of recurring, nameable categories, and builds a taxonomy from a systematic analysis of failure cases instead of treating each one as unique. [Which Agent Causes Task Failures and When?](https://arxiv.org/abs/2505.00212) (2025) approaches the same underlying problem from the diagnostic side, proposing a framework for automated failure attribution that identifies which agent, and at which step in an interaction, is actually responsible when a task fails, so that a person does not have to read through the full trace by hand. [JudgeFlow](https://arxiv.org/abs/2601.07477) (2026) applies a related idea at the level of a workflow's individual blocks: a "block judge" automatically evaluates each block in a pipeline and flags which ones are underperforming, on the premise that targeting the specific weak block is a more efficient use of effort than optimizing every block in a system uniformly.

A fourth paper in this group questions one of the more common assumptions about multi-agent systems directly. [Is Multi-Agent Debate the Silver Bullet?](https://arxiv.org/abs/2503.12029) (2025) tests, specifically on code summarization and code translation tasks, whether having several agents argue and critique each other before settling on an answer actually outperforms simpler baselines, an assumption the paper notes is rarely tested skeptically. It finds that multi-agent debate does not reliably outperform simpler approaches on these software engineering tasks, contrary to the common assumption that more agents arguing produces a better answer.

These four papers make a consistent point from different angles when you read them together. Adding agents, rounds, or debate structure to a system carries no automatic improvement. When a multi-agent system underperforms, the cause is usually attributable to a specific, identifiable agent or step, and the finding across this cluster is that the architecture as a whole is rarely the right level to diagnose the problem at.

## 3.5 Software engineering as an application domain

Most of the papers discussed so far were evaluated on general purpose benchmarks such as reasoning tasks, question answering, formatting compliance, and similar. A smaller set looks specifically at software engineering, where the surrounding context, an existing codebase, maintainability tradeoffs, project-specific conventions, adds complexity that abstract benchmarks like MMLU or HumanEval do not capture.

A [comprehensive survey](https://arxiv.org/abs/2510.09721) (2025) covering more than 150 papers organizes SE-focused agentic systems research along two axes: the type of solution, whether prompt-based, fine-tuning-based, or agent-based, and the type of benchmark, spanning code generation, translation, repair, and other tasks. Its contribution is the map itself, giving the field a shared way to locate where any given piece of work lies, and not a new method of its own.

[Benchmarking and Studying the LLM-based Agent System in End-to-End Software Development](https://arxiv.org/abs/2511.04064) (2025) addresses a specific methodological problem in comparing agent architectures for SE tasks. When each architecture is tested on a different benchmark with a different underlying model, it becomes impossible to tell whether a performance difference comes from the architecture, the model, or the benchmark. The paper holds model and infrastructure constant across three different architectures, so differences in outcome can be attributed to architecture alone. Even the best-performing combination met only around 50 percent of stated requirements on the paper's end-to-end benchmark. The main bottlenecks identified were agents skipping requirements outright and an inability to self-verify whether their own output was actually correct; no single architecture stood out as clearly superior across the board.

[Optimizing LLM-Based Multi-Agent System with Textual Feedback](https://arxiv.org/abs/2505.16086) (2025) is the paper in this set most directly grounded in real software development tasks. Its method works in two steps. An LLM-based locator identifies which agent in a role-based multi-agent system is underperforming and explains why in natural language. A second LLM-based optimizer rewrites only that agent's prompt, informed by the locator's explanation. Tested on real development tasks, the locator-plus-optimizer approach outperformed the unoptimized baseline on nearly every dimension and setting evaluated, with a single exception falling short by a small margin. The paper's broader point is a useful caution on its own: simple, uniform optimization baselines are inconsistent and specifically weak on the dimensions that matter most in real development, functionality above all, so an optimization method that works well on general benchmarks cannot be assumed to transfer cleanly to software engineering tasks.

## 3.6 Open gaps this literature leaves

Prompt optimization methods have matured from single-prompt gradient-style edits toward richer search strategies that combine evolutionary search, natural-language reflection, and joint search over instructions and demonstrations together. Multi-agent architecture is now understood as a variable worth searching over in its own right, alongside prompt wording, and joint optimization across agents has direct empirical support over optimizing agents independently. At the same time, a cluster of failure-analysis papers has made clear that adding agents or debate structure to a system carries no guarantee of improvement, and that failures in these systems tend to be traceable to specific agents or steps, with the architecture as a whole rarely the most useful level of explanation.

What this literature does not yet cover well is the intersection of these findings within software engineering specifically. MAS-PromptBench comes closest to systematically testing whether prompt optimization helps multi-agent systems and under what conditions, but every configuration in that benchmark optimizes agents separately and in sequence. Joint optimization is absent from its design entirely, and its task set is general-purpose. The SE-focused papers in this review study real development tasks and multi-agent roles, but none of them systematically vary architecture and optimization granularity, per-agent against joint, against each other the way MAS-PromptBench does for general tasks. A systematic study that holds a software engineering task fixed while varying both multi-agent architecture and optimization granularity together is a gap in this literature that has not yet been filled.

## References

- Pryzant, R. et al. "Automatic Prompt Optimization with 'Gradient Descent' and Beam Search." arXiv:2305.03495, 2023. [arxiv.org/abs/2305.03495](https://arxiv.org/abs/2305.03495)
    
- Yang, C. et al. "Large Language Models as Optimizers." arXiv:2309.03409, 2023. [arxiv.org/abs/2309.03409](https://arxiv.org/abs/2309.03409)
    
- Fernando, C. et al. "Promptbreeder: Self-Referential Self-Improvement via Prompt Evolution." arXiv:2309.16797, 2023. [arxiv.org/abs/2309.16797](https://arxiv.org/abs/2309.16797)
    
- Yuksekgonul, M. et al. "TextGrad: Automatic 'Differentiation' via Text." arXiv:2406.07496, 2024. [arxiv.org/abs/2406.07496](https://arxiv.org/abs/2406.07496)
    
- "AgentSquare: Automatic LLM Agent Search in Modular Design Space." arXiv:2410.06153, 2024. [arxiv.org/abs/2410.06153](https://arxiv.org/abs/2410.06153)
    
- "Multi-agent design: Optimizing agents with better prompts and topologies." arXiv:2502.02533, 2025. [arxiv.org/abs/2502.02533](https://arxiv.org/abs/2502.02533)
    
- "A Survey of Automatic Prompt Engineering: An Optimization Perspective." arXiv:2502.11560, 2025. [arxiv.org/abs/2502.11560](https://arxiv.org/abs/2502.11560)
    
- "A Systematic Survey of Automatic Prompt Optimization Techniques." arXiv:2502.16923, 2025. [arxiv.org/abs/2502.16923](https://arxiv.org/abs/2502.16923)
    
- "Is Multi-Agent Debate the Silver Bullet?" arXiv:2503.12029, 2025. [arxiv.org/abs/2503.12029](https://arxiv.org/abs/2503.12029)
    
- "Why Do Multi-Agent LLM Systems Fail?" arXiv:2503.13657, 2025. [arxiv.org/abs/2503.13657](https://arxiv.org/abs/2503.13657)
    
- "MARS: Multi-Agent Adaptive Reasoning with Socratic Guidance for Automated Prompt Optimization." arXiv:2503.16874, 2025. [arxiv.org/abs/2503.16874](https://arxiv.org/abs/2503.16874)
    
- "AutoPDL: Automatic Prompt Optimization for LLM Agents." arXiv:2504.04365, 2025. [arxiv.org/abs/2504.04365](https://arxiv.org/abs/2504.04365)
    
- "Which Agent Causes Task Failures and When? On Automated Failure Attribution of LLM Multi-Agent Systems." arXiv:2505.00212, 2025. [arxiv.org/abs/2505.00212](https://arxiv.org/abs/2505.00212)
    
- "Connecting the Dots: A Chain-of-Collaboration Prompting Framework for LLM Agents." arXiv:2505.10936, 2025. [arxiv.org/abs/2505.10936](https://arxiv.org/abs/2505.10936)
    
- "Optimizing LLM-Based Multi-Agent System with Textual Feedback: A Case Study on Software Development." arXiv:2505.16086, 2025. [arxiv.org/abs/2505.16086](https://arxiv.org/abs/2505.16086)
    
- Agrawal, L. et al. "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning." arXiv:2507.19457, 2025. [arxiv.org/abs/2507.19457](https://arxiv.org/abs/2507.19457)
    
- "MAPRO: Recasting Multi-Agent Prompt Optimization as Maximum a Posteriori Inference." arXiv:2510.07475, 2025. [arxiv.org/abs/2510.07475](https://arxiv.org/abs/2510.07475)
    
- "A Comprehensive Survey on Benchmarks and Solutions in Software Engineering of LLM-Empowered Agentic Systems." arXiv:2510.09721, 2025. [arxiv.org/abs/2510.09721](https://arxiv.org/abs/2510.09721)
    
- "Benchmarking and Studying the LLM-based Agent System in End-to-End Software Development." arXiv:2511.04064, 2025. [arxiv.org/abs/2511.04064](https://arxiv.org/abs/2511.04064)
    
- "JudgeFlow: Agentic Workflow Optimization via Block Judge." arXiv:2601.07477, 2026. [arxiv.org/abs/2601.07477](https://arxiv.org/abs/2601.07477)
    
- "MemAPO: Memory-Augmented Automatic Prompt Optimization." arXiv:2603.21520, 2026. [arxiv.org/abs/2603.21520](https://arxiv.org/abs/2603.21520)
    
- "MASPO: Joint Prompt Optimization for LLM-based Multi-Agent Systems." arXiv:2605.06623, 2026. [arxiv.org/abs/2605.06623](https://arxiv.org/abs/2605.06623)
    
- "Unifying Temporal and Structural Credit Assignment in LLM-based Multi-Agent Prompt Optimization." arXiv:2605.30227, 2026. [arxiv.org/abs/2605.30227](https://arxiv.org/abs/2605.30227)
    
- "MAS-PromptBench: When Does Prompt Optimization Improve Multi-Agent LLM Systems?" arXiv:2606.23664, 2026. [arxiv.org/abs/2606.23664](https://arxiv.org/abs/2606.23664)