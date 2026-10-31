# 001: Everything stays in the browser

- **Date:** 31 October 2026
- **Status:** Accepted

**Problem.** Vendor quotes are commercially sensitive. They name prices, negotiated discounts and sometimes the vendor's phone number. Storing them on a server would make VendorLens responsible for accounts, access control, retention and breach response.

**Choice.** Events, requirements, pasted quote text, confirmed quote fields and decisions are kept in IndexedDB (`vendorlens-v2`) on the user's device. A versioned JSON export and import is the backup and transfer path. The server keeps no copy of anything.

**Trade-offs.**

- There's no sync between devices and no shared workspace. The README lists these as limitations.
- Quote text leaves the device only when the user presses **Extract** after reading a consent note, and it is never logged.
- An import that fails validation is rejected without touching the plan that's already there.
