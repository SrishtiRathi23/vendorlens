# 002: The AI reads, the code computes

- **Date:** 31 October 2026
- **Status:** Accepted

**Problem.** Comparing quotes means reading messy, inconsistent text ("Rs. 950/plate + GST extra, staff on actuals") and then doing exact arithmetic. A language model is strong at the first and unreliable at the second. Pasted text can also contain instructions aimed at the model.

**Choice.**

1. Gemini extracts **candidate fields** from the quote: rates, units, inclusions, exclusions, tax mode and payment schedule. Each one comes with the exact excerpt it was taken from.
2. Code checks each excerpt really appears in the pasted text, and that every number Gemini reported appears in that excerpt. Anything that fails is marked _Not found in quote_.
3. The user confirms or corrects each field. Only confirmed values reach the calculator.
4. Pure functions compute base, extras, tax (in basis points, rounded once), the known total, comparability and payment milestones. A cost that is missing stays _unknown_, never zero.
5. Gemini also drafts the event plan and interprets adjustment requests. It returns structure (weights, requirements, tasks) that code turns into exact rupees and dates. It can't alter a vendor that has already been chosen.

**Trade-offs.** Extraction needs a review step, which costs the user a few seconds. In return, every number on screen can be traced to a source line, and a hostile quote can't change the arithmetic or reach a secret.
