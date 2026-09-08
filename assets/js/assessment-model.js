/* ==========================================================================
   Salesforce Readiness Review — assessment model  (v4)
   --------------------------------------------------------------------------
   Pure data. The engine renders whatever it finds here.

   THREE GATE QUESTIONS come first and shape everything after them:

     role   Who is answering. The SAME underlying question is reworded per
            role via `qr`, because an executive and a day-to-day user both
            know whether releases break things — they just don't recognise
            the question when it is phrased for the other one. Wrong wording
            makes people answer "not sure" when they actually know.

     cloud  Which part of Salesforce. Platform-hygiene sections (security,
            release, data, automation…) are universal and always asked. The
            PROCESS sections fork completely: asking a Service Cloud org
            about opportunity stages is nonsense.

     depth  A tier ceiling. Each question carries `t` 1..3; quick pass shows
            tier 1, standard adds 2, full audit adds 3. Tier 1 is the set that
            predicts most of the risk on its own, so a three-minute pass is
            still worth something. Keep the forks symmetric — the estimated
            times assume every cloud has the same count at each tier.

   QUESTION FIELDS
     q       base wording, used when no role variant exists
     qr      { exec|lead|admin|user: '…' } role-specific rewording
     help    optional clarifier;  helpr  same, per role
     t       1..3 depth tier; omit = 2
     clouds  ['sales'…] restricts the question; omit = all clouds
     showIf  { q:'id', not:[i…] } | { q:'id', in:[i…] }
     opts    v 0..3 (higher is healthier), label, unsure, fn (flag name), flag

   SECTION FIELDS
     clouds  restricts the whole section; omit = all clouds

   Severity in the workbook is derived: v === 0 is High, v === 1 is Medium.
   Everything is answered by index, so state encodes to a positional string.
   ========================================================================== */
window.ASSESSMENT = {
  version: 6,
  unsureCeiling: 0.35,

  /* Reading a question, weighing four or five options and deciding runs about
     this. Times shown in the gate are computed from it and the live question
     count, so they stay honest as the bank grows. */
  secondsPerQuestion: 13,

  depths: [
    { id: 'quick', tier: 1, label: 'Quick pass',
      desc: 'The handful of questions that predict most of the risk on their own' },
    { id: 'std',   tier: 2, label: 'Standard review',
      desc: 'The version most people should take. Enough to be worth acting on' },
    { id: 'full',  tier: 3, label: 'Full audit',
      desc: 'Every question, including ones only an admin will know off the top of their head' }
  ],

  roles: [
    { id: 'exec',  label: 'Executive or budget holder', desc: 'You pay for it and answer for the outcome' },
    { id: 'lead',  label: 'Ops or project lead',        desc: 'You own the process and the roadmap' },
    { id: 'admin', label: 'Admin or developer',         desc: 'You are inside the org every day' },
    { id: 'user',  label: 'Day-to-day user',            desc: 'You work in it; someone else configures it' }
  ],

  clouds: [
    { id: 'sales',     label: 'Sales Cloud',      desc: 'Leads, opportunities, pipeline, forecasting' },
    { id: 'service',   label: 'Service Cloud',    desc: 'Cases, queues, SLAs, support channels' },
    { id: 'ae',        label: 'Account Engagement', desc: 'B2B marketing automation, formerly Pardot' },
    { id: 'mc',        label: 'Marketing Cloud',   desc: 'Multi-channel: email, SMS, journeys, Data Cloud' },
    { id: 'platform',  label: 'A custom app',      desc: 'Salesforce as a platform for something bespoke' }
  ],

  sections: [

    /* ======================= COMMON — FOUNDATION ======================= */
    {
      id: 'own', title: 'Ownership & team', step: 'Prepare',
      blurb: 'Who is actually responsible. More implementations stall here than on any technical problem.',
      questions: [
        {
          id: 'own1', t: 2, shape: 'polar',
          q: 'Is there a named executive sponsor for Salesforce?',
          qr: {
            exec: 'Is it clear who owns Salesforce at leadership level?',
            user: 'Is there someone senior who visibly champions Salesforce?',
            admin: 'Is there someone senior who owns Salesforce decisions above your level?'
          },
          help: 'Someone senior enough to resolve cross-department disputes and defend the budget.',
          opts: [
            { k: 'a', v: 3, label: 'Yes, actively engaged' },
            { k: 'b', v: 2, label: 'Named, but not very involved' },
            { k: 'c', v: 1, label: 'Unclear who it would be', fn: 'No clear sponsor', flag: 'No clear executive sponsor. Cross-team disputes stall indefinitely without one, and the work cut first is usually documentation and testing.' },
            { k: 'd', v: 0, label: 'Nobody', fn: 'No executive sponsor', flag: 'No executive sponsor. Prioritisation conflicts escalate to whoever complains loudest rather than to whoever has the strongest case.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'own2', t: 1, shape: 'identity',
          q: 'Who administers the org day to day?',
          qr: {
            exec: 'Who is responsible for keeping Salesforce running day to day?',
            user: 'Who do you go to when something in Salesforce needs changing?'
          },
          opts: [
            { k: 'a', v: 3, label: 'A dedicated internal admin' },
            { k: 'b', v: 2, label: 'Someone internal, part time' },
            { k: 'c', v: 1, label: 'An external partner only', fn: 'Administration outsourced', flag: 'Administration is entirely external. Institutional knowledge lives outside the business, which is expensive at renewal and painful if the relationship ends.' },
            { k: 'd', v: 0, label: 'Effectively nobody', fn: 'No day-to-day owner', flag: 'No day-to-day owner. Unowned orgs drift: permissions accumulate, data quality decays, and nobody notices a broken automation until a customer does.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'own3', t: 1, shape: 'polar',
          q: 'If your admin left tomorrow, could someone else pick it up?',
          qr: {
            admin: 'If you left tomorrow, could someone else pick up your work from what is written down?',
            exec: 'If the person who knows Salesforce best left, could anyone else pick it up?',
            user: 'If the person you go to for Salesforce left, would anyone else know how it works?'
          },
          help: 'The single best proxy for whether an org is documented.',
          showIf: { q: 'own2', not: [3] },
          opts: [
            { k: 'a', v: 3, label: 'Yes — it is documented' },
            { k: 'b', v: 2, label: 'Mostly, with some digging' },
            { k: 'c', v: 1, label: 'It would be painful', fn: 'Key-person concentration', flag: 'Knowledge is concentrated in one person. This is the most common reason an org becomes a black box, and it is entirely preventable with documentation.' },
            { k: 'd', v: 0, label: 'No — it would be a crisis', fn: 'Single point of failure', flag: 'Single point of failure on one person’s knowledge. Treat this as operational risk, not inconvenience — it is the highest-leverage item on this whole review.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'own4', t: 3, shape: 'polar',
          q: 'Are the people who actually use Salesforce consulted before changes ship?',
          qr: {
            user: 'Does anyone ask you before Salesforce changes?',
            admin: 'Do you get to talk to users before building what you have been asked for?',
            exec: 'Do changes get validated with the people who use the system before release?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, routinely' },
            { k: 'b', v: 2, label: 'Sometimes' },
            { k: 'c', v: 1, label: 'Rarely', fn: 'Users not consulted', flag: 'Users are rarely consulted. This is the usual root cause of low adoption, and of fields that get built, ignored, and never removed.' },
            { k: 'd', v: 0, label: 'Never', fn: 'Users never consulted', flag: 'Changes ship without user input at all. Adoption problems here are a symptom, not the disease.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'own5', t: 3, shape: 'polar',
          q: 'Does anyone hold the whole picture of how the org fits together?',
          qr: {
            exec: 'Is there one person who could explain how the whole system fits together?',
            admin: 'Could you draw how the pieces connect, or only the parts you built?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, and it is written down' },
            { k: 'b', v: 2, label: 'One person holds it in their head' },
            { k: 'c', v: 1, label: 'Everyone knows their own corner', fn: 'No whole-system view', flag: 'Nobody holds the whole picture. Changes are then made locally correct and globally wrong, which is how two teams end up automating the same field in opposite directions.' },
            { k: 'd', v: 0, label: 'Nobody', fn: 'No system understanding', flag: 'No one understands the system as a whole. Establishing that — read-only, before changing anything — is the prerequisite for every other item on this review.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ========================= COMMON — PURPOSE ======================== */
    {
      id: 'goal', title: 'Vision & goals', step: 'Prepare',
      blurb: 'What the org is for, and how you would know if it were working.',
      questions: [
        {
          id: 'goal1', t: 3, shape: 'polar',
          q: 'Is there a written statement of what Salesforce is meant to achieve?',
          qr: {
            user: 'Has anyone explained to you what Salesforce is meant to achieve?',
            admin: 'Is there a documented objective you can point at when someone requests a change?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, and people know it' },
            { k: 'b', v: 2, label: 'Written down somewhere' },
            { k: 'c', v: 1, label: 'Understood informally', fn: 'No written vision', flag: 'No written vision. Every stakeholder optimises for their own team and the data model becomes a compromise nobody is happy with.' },
            { k: 'd', v: 0, label: 'No', fn: 'No stated purpose', flag: 'No stated purpose for the platform. Investment decisions end up driven by whoever asked most recently.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'goal2', t: 3, shape: 'polar',
          q: 'Are your goals measurable?',
          qr: {
            exec: 'Could you state, in numbers, what Salesforce is supposed to improve?',
            user: 'Is it clear what good looks like for the work you do in Salesforce?'
          },
          help: '"Shorten the sales cycle by 10 days" rather than "improve visibility".',
          opts: [
            { k: 'a', v: 3, label: 'Yes, with numbers and dates' },
            { k: 'b', v: 2, label: 'Directionally, not numerically' },
            { k: 'c', v: 1, label: 'Vague', fn: 'Goals not measurable', flag: 'Goals are not measurable, so there is no way to tell whether a change helped — and no way to justify further investment.' },
            { k: 'd', v: 0, label: 'None defined', fn: 'No goals defined', flag: 'No defined goals. Whether the platform is working is necessarily a matter of opinion.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'goal3', t: 1, shape: 'polar',
          q: 'Can your current reports actually answer those goals?',
          qr: {
            exec: 'Can you get the numbers you need from Salesforce without asking someone to build something?',
            user: 'Can you get the numbers you need out of Salesforce yourself?',
            admin: 'Can reporting requests be answered with the fields you already have?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes' },
            { k: 'b', v: 2, label: 'Partly — some manual work needed' },
            { k: 'c', v: 1, label: 'Numbers get rebuilt in spreadsheets', fn: 'Reporting redone offline', flag: 'Reporting is being redone in spreadsheets. That is usually a data model problem, not a reporting problem, and it quietly doubles the cost of every month-end.' },
            { k: 'd', v: 0, label: 'No', fn: 'Reports cannot answer the questions', flag: 'Reports cannot answer the business questions. Diagnose before building anything new — new fields on a broken model make reporting worse, not better.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'goal4', t: 3, shape: 'recency',
          q: 'When was Salesforce last meaningfully reviewed against what the business needs now?',
          qr: {
            exec: 'When was Salesforce last reviewed against how the business works today?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Within the last year' },
            { k: 'b', v: 2, label: 'A couple of years ago' },
            { k: 'c', v: 1, label: 'Not since it was implemented', fn: 'Never reviewed since launch', flag: 'The org has not been reviewed against business need since it was built. Businesses change faster than their CRMs, and the gap shows up first as workarounds and shadow spreadsheets rather than as complaints.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ==================== CLOUD FORK — SALES PROCESS =================== */
    {
      id: 'psale', title: 'Pipeline & sales process', step: 'Prepare', clouds: ['sales'],
      blurb: 'Whether the pipeline reflects how deals actually get done.',
      questions: [
        {
          id: 'psale1', t: 1, shape: 'polar',
          q: 'Is your sales process documented anywhere?',
          qr: {
            user: 'Is there a written description of how a deal is supposed to progress?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with a diagram' },
            { k: 'b', v: 2, label: 'Written, no diagram' },
            { k: 'c', v: 1, label: 'In people’s heads', fn: 'Sales process undocumented', flag: 'The sales process is undocumented. Automation built on it encodes assumptions nobody has stated, which is how contradictory rules end up in one org.' },
            { k: 'd', v: 0, label: 'It varies by rep', fn: 'Process differs per rep', flag: 'The process differs per person, so pipeline data is not comparable across the team and forecasting is unreliable regardless of tooling.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'psale2', t: 1, shape: 'polar',
          q: 'Do your opportunity stages mean the same thing to everyone?',
          qr: {
            user: 'Would a colleague move a deal to the next stage at the same point you would?',
            exec: 'Do you trust that a given stage means the same thing across the whole team?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with written exit criteria' },
            { k: 'b', v: 2, label: 'Broadly consistent' },
            { k: 'c', v: 1, label: 'Interpreted differently by rep', fn: 'Stages inconsistent', flag: 'Stage definitions are interpreted inconsistently. Stage-based forecasting and conversion metrics are not trustworthy until exit criteria are written down.' },
            { k: 'd', v: 0, label: 'No shared definition', fn: 'No stage definitions', flag: 'Stages have no shared definition, so pipeline reporting is aggregating things that are not comparable.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'psale3', t: 3, shape: 'method',
          q: 'How do leads enter the system and get worked?',
          qr: {
            exec: 'How are leads routed and followed up?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Defined routing and follow-up rules' },
            { k: 'b', v: 2, label: 'Mostly consistent' },
            { k: 'c', v: 1, label: 'Ad hoc', fn: 'Lead handling ad hoc', flag: 'Lead handling is ad hoc. Leads go stale in unowned queues and source attribution becomes guesswork.' },
            { k: 'd', v: 3, label: 'We do not use leads' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'psale4', t: 3, shape: 'degree',
          q: 'How reliable is your forecast?',
          qr: {
            exec: 'How close does the forecast usually land to the actual number?',
            user: 'How much does your team rely on the Salesforce forecast?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Close, and trusted' },
            { k: 'b', v: 2, label: 'Roughly right' },
            { k: 'c', v: 1, label: 'Adjusted by hand before anyone sees it', fn: 'Forecast manually corrected', flag: 'The forecast is manually corrected before use. That correction is undocumented judgement, and it disappears when the person applying it does.' },
            { k: 'd', v: 0, label: 'Nobody relies on it', fn: 'Forecast not trusted', flag: 'The forecast is not trusted. That usually traces back to stage definitions rather than to the forecasting tooling itself.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* =================== CLOUD FORK — SERVICE PROCESS ================== */
    {
      id: 'psvc', title: 'Cases & service process', step: 'Prepare', clouds: ['service'],
      blurb: 'Whether support work is routed, measured and resolved predictably.',
      questions: [
        {
          id: 'psvc1', t: 1, shape: 'polar',
          q: 'Is your case handling process documented?',
          qr: {
            user: 'Is there a written description of how a case should be handled from open to close?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with a diagram' },
            { k: 'b', v: 2, label: 'Written, no diagram' },
            { k: 'c', v: 1, label: 'In people’s heads', fn: 'Case process undocumented', flag: 'The case process is undocumented, so every agent resolves differently and quality depends on who picked up the case.' },
            { k: 'd', v: 0, label: 'It varies by agent', fn: 'Process differs per agent', flag: 'Handling differs per agent. Resolution-time metrics are measuring people rather than process.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'psvc2', t: 1, shape: 'method',
          q: 'How do cases get routed to the right person?',
          qr: {
            user: 'How do cases get assigned to you?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Automated routing that works' },
            { k: 'b', v: 2, label: 'Automated, with manual correction' },
            { k: 'c', v: 1, label: 'Manually triaged by someone', fn: 'Manual case triage', flag: 'Cases are triaged by hand. This scales badly and creates a single point of failure whenever that person is away.' },
            { k: 'd', v: 0, label: 'Agents pick from a shared pile', fn: 'No routing', flag: 'No routing at all. Easy cases get taken first and hard ones age, which is invisible in averages.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'psvc3', t: 3, shape: 'polar',
          q: 'Are response and resolution targets tracked?',
          qr: {
            exec: 'Do you know whether you are meeting the response times you promise customers?',
            user: 'Is it clear how quickly you are expected to respond?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with entitlements or milestones' },
            { k: 'b', v: 2, label: 'Tracked informally' },
            { k: 'c', v: 1, label: 'Targets exist but are not measured', fn: 'SLAs unmeasured', flag: 'Service targets exist but are not measured, so breaches are discovered by the customer rather than by you.' },
            { k: 'd', v: 0, label: 'No targets', fn: 'No service targets', flag: 'No response or resolution targets. There is no basis for staffing decisions or for telling customers what to expect.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'psvc4', t: 3, shape: 'polar',
          q: 'Is there a knowledge base agents actually use?',
          qr: {
            user: 'Is there somewhere reliable to look when you hit a question you cannot answer?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, maintained and used' },
            { k: 'b', v: 2, label: 'Exists, patchily maintained' },
            { k: 'c', v: 1, label: 'Exists but nobody trusts it', fn: 'Knowledge base stale', flag: 'The knowledge base is not trusted, so answers get re-derived every time and vary between agents.' },
            { k: 'd', v: 0, label: 'None', fn: 'No knowledge base', flag: 'No knowledge base. Expertise stays trapped in individual agents and every departure costs real capability.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ============== CLOUD FORK - ACCOUNT ENGAGEMENT (B2B) ============== */
    /* Sourced from the Account Engagement implementation, deliverability,
       connected-campaigns and user-sync guides. The connector is the single
       most common failure point in an AE org, so it leads. */
    {
      id: 'pmae', title: 'Account Engagement', step: 'Prepare', clouds: ['ae'],
      blurb: 'The connector, the campaign link back to Salesforce, and whether your email actually arrives.',
      questions: [
        {
          id: 'pmae1', t: 1, shape: 'degree',
          q: 'How healthy is the sync between Salesforce and Account Engagement?',
          qr: {
            exec: 'How reliably do marketing and sales see the same picture of a prospect?',
            user: 'How reliably do records you update in one system appear in the other?'
          },
          help: 'Connector sync errors are the most common single problem in an Account Engagement org.',
          opts: [
            { k: 'a', v: 3, label: 'Clean, and errors are monitored' },
            { k: 'b', v: 2, label: 'Mostly fine, occasional errors' },
            { k: 'c', v: 1, label: 'A known backlog of sync errors', fn: 'Connector errors unresolved', flag: 'The connector has an unresolved error backlog. Every failed record is a prospect whose marketing and sales history have silently diverged, and the queue grows quietly until someone works it.' },
            { k: 'd', v: 0, label: 'Nobody looks at it', fn: 'Connector unmonitored', flag: 'Nobody monitors the connector. Sync failures stay invisible until a rep notices a prospect with no activity history, by which point the gap can be months deep.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pmae2', t: 1, shape: 'method',
          q: 'How is consent and opt-out handled?',
          qr: {
            exec: 'How would you evidence consent for everyone you email?',
            user: 'How is an unsubscribe applied across your lists and systems?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Centralised and auditable' },
            { k: 'b', v: 2, label: 'Handled, but not centrally' },
            { k: 'c', v: 1, label: 'Managed per list or per system', fn: 'Consent fragmented', flag: 'Consent is tracked per list rather than centrally. An unsubscribe honoured in one place and ignored in another is both a compliance exposure and the fastest way to damage sender reputation.' },
            { k: 'd', v: 0, label: 'Not really tracked', fn: 'Consent not tracked', flag: 'Consent is not reliably tracked. This is a regulatory exposure before it is a marketing problem.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pmae3', t: 3, shape: 'polar',
          q: 'Are Account Engagement campaigns connected to Salesforce campaigns?',
          qr: {
            exec: 'Can you follow a marketing campaign through to the revenue it produced?'
          },
          help: 'Connected Campaigns is what makes campaign influence and closed-loop reporting possible.',
          opts: [
            { k: 'a', v: 3, label: 'Yes, with campaign influence reporting' },
            { k: 'b', v: 2, label: 'Connected, reporting is basic' },
            { k: 'c', v: 1, label: 'Maintained separately', fn: 'Campaigns not connected', flag: 'Marketing and Salesforce campaigns are maintained separately. Attribution has to be reassembled by hand, and the two lists drift apart the moment nobody is actively reconciling them.' },
            { k: 'd', v: 0, label: 'No link at all', fn: 'No campaign link', flag: 'No connection between marketing and Salesforce campaigns, so there is no path from marketing activity to pipeline. Enabling Connected Campaigns is usually the highest-value single change available here.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pmae4', t: 3, shape: 'polar',
          q: 'Is email authentication set up for every sending domain?',
          qr: {
            exec: 'Are the domains you send marketing from properly authenticated?',
            user: 'Has anyone confirmed the domains you send from are set up correctly?'
          },
          help: 'Domain verification plus SPF and DKIM. No tool can rescue a sending reputation already damaged.',
          opts: [
            { k: 'a', v: 3, label: 'Verified, with SPF and DKIM in place' },
            { k: 'b', v: 2, label: 'Set up, not recently checked' },
            { k: 'c', v: 1, label: 'Partly - some domains only', fn: 'Authentication incomplete', flag: 'Email authentication is incomplete across sending domains. Unauthenticated mail is filtered more aggressively every year, and reputation is far slower to rebuild than to lose.' },
            { k: 'd', v: 0, label: 'Not set up', fn: 'Sending domains unauthenticated', flag: 'Sending domains are not authenticated. Fix SPF, DKIM and domain verification before spending anything further on campaign content - deliverability sits upstream of everything else.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ============== CLOUD FORK - MARKETING CLOUD (MULTI) =============== */
    /* Sourced from the Marketing Cloud setup checklist and implementation
       guide: data kits, identity resolution, consent validation, channel
       setup and the analytics packages. */
    {
      id: 'pmmc', title: 'Marketing Cloud', step: 'Prepare', clouds: ['mc'],
      blurb: 'Audience data, consent across channels, and whether sending is set up to actually arrive.',
      questions: [
        {
          id: 'pmmc1', t: 1, shape: 'degree',
          q: 'How well is your audience data unified?',
          qr: {
            exec: 'How reliably does one customer appear as one person across your channels?',
            user: 'How well is customer data joined up across your channels?'
          },
          help: 'Identity resolution decides whether a person is one profile or several.',
          opts: [
            { k: 'a', v: 3, label: 'Identity resolution configured and reviewed' },
            { k: 'b', v: 2, label: 'Configured, not revisited' },
            { k: 'c', v: 1, label: 'People appear more than once', fn: 'Identity resolution weak', flag: 'The same person resolves to several profiles. That inflates audience counts, splits engagement history, and produces the duplicate and contradictory sends customers notice immediately.' },
            { k: 'd', v: 0, label: 'No unification at all', fn: 'No identity resolution', flag: 'Audience data is not unified, so every channel works from its own version of the customer. Cross-channel reporting is not comparable and suppression cannot be trusted.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pmmc2', t: 1, shape: 'method',
          q: 'How is consent handled across channels?',
          qr: {
            exec: 'How would you evidence consent for every channel you contact people on?',
            user: 'How is an opt-out on one channel applied to the others?'
          },
          help: 'Consent validation, subscriptions and preference pages - email, SMS and WhatsApp each carry their own rules.',
          opts: [
            { k: 'a', v: 3, label: 'Centralised, with preference pages' },
            { k: 'b', v: 2, label: 'Per channel, but consistent' },
            { k: 'c', v: 1, label: 'Per channel, inconsistently', fn: 'Consent inconsistent across channels', flag: 'Consent is handled differently per channel. Opting out of one and continuing to receive another is the complaint most likely to become a regulatory problem.' },
            { k: 'd', v: 0, label: 'Not really tracked', fn: 'Consent not tracked', flag: 'Consent is not reliably tracked across channels. SMS in particular carries penalties that make this a legal exposure rather than a marketing one.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pmmc3', t: 3, shape: 'polar',
          q: 'Is sending set up properly for every channel you use?',
          qr: {
            exec: 'Is sending properly configured on every channel you use?'
          },
          help: 'Domain authentication and verified senders for email; a registered brand and campaign for SMS.',
          opts: [
            { k: 'a', v: 3, label: 'Fully configured and verified' },
            { k: 'b', v: 2, label: 'Configured, not recently checked' },
            { k: 'c', v: 1, label: 'Gaps on some channels', fn: 'Channel setup incomplete', flag: 'Sending configuration is incomplete on at least one channel. Unregistered SMS traffic in particular is filtered or blocked outright by carriers rather than merely deprioritised.' },
            { k: 'd', v: 0, label: 'Not confident it is', fn: 'Sending setup unverified', flag: 'Sending setup is unverified. Domain authentication and, for SMS, brand and campaign registration are prerequisites for delivery - not optimisations.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pmmc4', t: 3, shape: 'polar',
          q: 'Can you measure what your marketing actually produced?',
          qr: {
            exec: 'Can you tell which marketing spend produced revenue?'
          },
          help: 'The analytics packages and reporting that close the loop back to pipeline.',
          opts: [
            { k: 'a', v: 3, label: 'Yes, end to end' },
            { k: 'b', v: 2, label: 'Channel metrics, not revenue' },
            { k: 'c', v: 1, label: 'Only opens and clicks', fn: 'Measurement stops at engagement', flag: 'Measurement stops at engagement metrics. Opens and clicks show a message was received, not that it was worth sending, and budget then gets allocated on the wrong signal.' },
            { k: 'd', v: 0, label: 'No reporting set up', fn: 'No marketing reporting', flag: 'No reporting is configured, so marketing spend is allocated on instinct and effective campaigns cannot be distinguished from loud ones.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* =================== CLOUD FORK — CUSTOM PLATFORM ================== */
    {
      id: 'pplat', title: 'The application', step: 'Prepare', clouds: ['platform'],
      blurb: 'Whether the custom build is understood well enough to change safely.',
      questions: [
        {
          id: 'pplat1', t: 1, shape: 'polar',
          q: 'Is what the application does written down anywhere?',
          opts: [
            { k: 'a', v: 3, label: 'Yes, current documentation' },
            { k: 'b', v: 2, label: 'Documented, somewhat stale' },
            { k: 'c', v: 1, label: 'Only in the code', fn: 'Behaviour only in code', flag: 'Behaviour is documented only by the code itself, so every question about intent becomes an archaeology exercise.' },
            { k: 'd', v: 0, label: 'Nowhere', fn: 'No documentation', flag: 'No documentation of intended behaviour. Nobody can distinguish a bug from a deliberate decision, which makes safe change impossible.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pplat2', t: 1, shape: 'identity',
          q: 'Who originally built it?',
          opts: [
            { k: 'a', v: 3, label: 'People still here' },
            { k: 'b', v: 2, label: 'A partner we still work with' },
            { k: 'c', v: 1, label: 'A partner we no longer use', fn: 'Original builders gone', flag: 'The original builders are gone. Expect undocumented assumptions to surface as soon as anything is changed.' },
            { k: 'd', v: 0, label: 'Nobody knows', fn: 'Provenance unknown', flag: 'The application’s provenance is unknown. Establishing what it does — read-only — should precede any change to it.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pplat3', t: 3, shape: 'polar',
          q: 'Are there automated tests beyond the Salesforce minimum?',
          qr: {
            exec: 'Is there anything that automatically catches a change breaking something else?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, meaningful coverage' },
            { k: 'b', v: 2, label: 'Some, on the critical paths' },
            { k: 'c', v: 1, label: 'Only enough to deploy', fn: 'Tests are box-ticking', flag: 'Tests exist only to satisfy the deployment threshold. They assert nothing useful, so they give false confidence rather than real protection.' },
            { k: 'd', v: 0, label: 'No', fn: 'No meaningful tests', flag: 'No meaningful automated tests. Every release is verified by hand, or not at all.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'pplat4', t: 3, shape: 'polar',
          q: 'Do users of the app have a way to report that it is behaving wrongly?',
          opts: [
            { k: 'a', v: 3, label: 'Yes, with triage' },
            { k: 'b', v: 2, label: 'Informally' },
            { k: 'c', v: 0, label: 'Not really', fn: 'No defect route', flag: 'No route for reporting incorrect behaviour, so defects are absorbed as workarounds and never fixed.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ==================== COMMON — DATA MODEL / UI ===================== */
    {
      id: 'model', title: 'Data model & layouts', step: 'Set up',
      blurb: 'Field discipline. Easy to get wrong precisely because it is so easy to add things.',
      questions: [
        {
          id: 'model1', t: 2, shape: 'polar',
          q: 'Do you know which of your custom fields are actually used?',
          qr: {
            user: 'Do you know which fields on your screens are actually used?',
            exec: 'Does anyone review whether the data being captured is still needed?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, reviewed regularly' },
            { k: 'b', v: 2, label: 'Roughly' },
            { k: 'c', v: 0, label: 'There are many nobody understands', fn: 'Severe field bloat', flag: 'Significant field bloat with no ownership. A field-usage audit is cheap, entirely read-only, and usually removes a surprising percentage on the first pass.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true, fn: 'Field usage unknown', flag: 'Field usage has never been audited. Bloat slows page loads, confuses users, and inflates the cost of every future migration.' }
          ]
        },
        {
          id: 'model2', t: 3, shape: 'polar',
          q: 'Is there a naming convention for fields and objects?',
          qr: {
            user: 'Do field names follow a consistent pattern?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, enforced' },
            { k: 'b', v: 2, label: 'Loosely followed' },
            { k: 'c', v: 1, label: 'No', fn: 'No naming convention', flag: 'No naming convention. Minor in isolation, but it compounds — it is the main reason nobody can find the right field when building a report.' },
            { k: 'd', v: 0, label: 'Actively inconsistent', fn: 'Naming inconsistent', flag: 'Naming is actively inconsistent, making report building slow and error-prone for anyone who did not build the fields.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'model3', t: 1, shape: 'count',
          q: 'How many required fields does a user hit on a typical record?',
          qr: {
            user: 'How many fields are you forced to fill in on a typical record?',
            exec: 'How many fields are your teams required to complete on a typical record?'
          },
          help: 'The 2013 guide warned about this and it is still the most common adoption killer.',
          opts: [
            { k: 'a', v: 3, label: 'Only genuinely necessary ones' },
            { k: 'b', v: 2, label: 'A few more than ideal' },
            { k: 'c', v: 1, label: 'Enough that people complain', fn: 'Too many required fields', flag: 'Too many required fields. Users respond with placeholder values, which is worse than no data because it looks real in reports.' },
            { k: 'd', v: 0, label: 'People enter junk to get past them', fn: 'Required fields defeated', flag: 'Required fields are being defeated with junk. Your reports currently measure compliance with the form, not reality.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ======================== COMMON — SECURITY ======================== */
    {
      id: 'sec', title: 'Security & access', step: 'Set up',
      blurb: 'Who can see and do what. Usually correct on day one and quietly wrong three years later.',
      questions: [
        {
          id: 'sec1', t: 1, shape: 'polar',
          q: 'Do you know your org-wide default sharing settings?',
          qr: {
            exec: 'Is it a deliberate decision who can see which records?',
            user: 'Is it clear and intentional which records you can and cannot see?',
            lead: 'Was the decision about who sees whose records made deliberately?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, and they are deliberate' },
            { k: 'b', v: 2, label: 'Roughly' },
            { k: 'c', v: 0, label: 'No — it has just evolved', fn: 'Sharing model unknown', flag: 'The sharing model is not understood. This is where an org is most likely to be exposing data internally without anyone realising — review it first if you handle regulated, customer or financial data.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec2', t: 2, shape: 'polar',
          q: 'Does your role hierarchy reflect who needs to see what?',
          qr: {
            exec: 'Does data visibility follow business need rather than just the org chart?',
            user: 'Does who can see what match who actually needs to see it?'
          },
          help: 'It is a data-visibility structure, not an org chart — a distinction many orgs miss.',
          opts: [
            { k: 'a', v: 3, label: 'Yes, designed for data access' },
            { k: 'b', v: 2, label: 'It mirrors the org chart' },
            { k: 'c', v: 1, label: 'It is out of date', fn: 'Stale role hierarchy', flag: 'The role hierarchy is stale. Stale hierarchies over-grant rather than under-grant, so people retain visibility long after changing roles.' },
            { k: 'd', v: 1, label: 'We do not really use roles' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec3', t: 3, shape: 'method',
          q: 'How are user permissions managed?',
                    opts: [
            { k: 'a', v: 3, label: 'Permission sets, profiles minimal' },
            { k: 'b', v: 2, label: 'A mix' },
            { k: 'c', v: 1, label: 'Almost entirely profiles', fn: 'Permissions locked in profiles', flag: 'Permissions live mostly in profiles. Salesforce is deprecating permissions on profiles, so this becomes forced migration work — cheaper done deliberately.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec4', t: 2, shape: 'polar',
          q: 'When someone leaves, is their access removed promptly?',
          qr: {
            exec: 'Are you confident nobody who has left still has access?',
            user: 'Is access removed promptly when someone leaves?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, part of offboarding' },
            { k: 'b', v: 2, label: 'Usually, eventually' },
            { k: 'c', v: 1, label: 'Inconsistently', fn: 'Offboarding inconsistent', flag: 'Offboarding is inconsistent. Active licences for departed staff are both a security exposure and a directly recoverable cost.' },
            { k: 'd', v: 0, label: 'Probably not', fn: 'Departed users retain access', flag: 'Departed users may still have access. This is the first thing an auditor checks and the cheapest finding to avoid.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec5', t: 3, shape: 'polar',
          q: 'Do you know what data your AI features can see?',
          qr: {
            exec: 'Has anyone checked what customer data your AI features can reach?',
            user: 'Has anyone checked what information the AI features are able to show you?',
            admin: 'Have you reviewed what records the AI features can actually read?'
          },
          help: 'Einstein and Agentforce features inherit the running user\u2019s access, which is only safe if that access is already correct.',
          opts: [
            { k: 'a', v: 3, label: 'Reviewed, and access is deliberate' },
            { k: 'b', v: 2, label: 'Some AI features, access understood' },
            { k: 'c', v: 1, label: 'AI features on, access never reviewed', fn: 'AI data access unreviewed', flag: 'AI features are enabled without anyone reviewing what they can read. These features surface data through a new route, so a sharing model that was merely untidy becomes actively visible \u2014 they expose existing over-permissioning rather than creating it.' },
            { k: 'd', v: 3, label: 'No AI features enabled' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec6', t: 3, shape: 'recency',
          q: 'When did anyone last run Security Health Check?',
          qr: {
            exec: 'When did anyone last check that your security settings meet a sensible baseline?',
            admin: 'When did you last open Health Check and act on what it said?'
          },
          help: 'Salesforce ships a free baseline comparison in Setup. Most orgs have never opened it.',
          opts: [
            { k: 'a', v: 3, label: 'Regularly, and we act on it' },
            { k: 'b', v: 2, label: 'Looked at it at some point' },
            { k: 'c', v: 1, label: 'Never run it', fn: 'Health Check never run', flag: 'Security Health Check has never been run. It is free, takes minutes, and scores your org against a baseline — there is no cheaper way to find out whether session settings, password policy and sharing defaults have quietly drifted.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec7', t: 3, shape: 'polar',
          q: 'Is multi-factor authentication enforced for everyone?',
          qr: {
            exec: 'Is multi-factor authentication required for every person who logs into Salesforce?',
            user: 'Do you need a second step — an app or a code — to log in?'
          },
          help: 'MFA is contractually required by Salesforce, not merely recommended.',
          opts: [
            { k: 'a', v: 3, label: 'Yes, everyone including integrations' },
            { k: 'b', v: 2, label: 'Yes for people, exceptions exist' },
            { k: 'c', v: 1, label: 'Partially rolled out', fn: 'MFA incomplete', flag: 'MFA is not enforced for everyone. Salesforce requires it contractually, and the accounts usually exempted — admins and integration users — are precisely the ones worth compromising.' },
            { k: 'd', v: 0, label: 'No', fn: 'No MFA', flag: 'No multi-factor authentication. This is both a contractual breach of your Salesforce agreement and the single highest-value security gap in the org.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec8', t: 3, shape: 'polar',
          q: 'Would you know if someone exported a large volume of records?',
          qr: {
            exec: 'If a departing employee downloaded your entire customer list, would you find out?',
            admin: 'Do you have event monitoring or transaction security policies on large exports?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, monitored and alerted' },
            { k: 'b', v: 2, label: 'Could reconstruct it after the fact' },
            { k: 'c', v: 1, label: 'Probably not', fn: 'Bulk export undetected', flag: 'Large exports would go unnoticed. Departing employees taking the customer list is among the most common data-loss events, and it leaves traces only if something is watching for them.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec9', t: 3, shape: 'count',
          q: 'How many people have full administrator rights?',
          qr: {
            exec: 'How many people could change anything in Salesforce, including deleting data?',
            user: 'How many people can change anything in Salesforce?'
          },
          opts: [
            { k: 'a', v: 3, label: 'A deliberate, small number' },
            { k: 'b', v: 2, label: 'A few more than strictly needed' },
            { k: 'c', v: 1, label: 'More than we could justify', fn: 'Admin rights over-granted', flag: 'Administrator rights are spread wider than necessary. Every extra admin is an account that can bypass sharing, export anything, and change automation without review — and admin counts only ever grow unless someone actively prunes them.' },
            { k: 'd', v: 0, label: 'No idea, nobody tracks it', fn: 'Admin access untracked', flag: 'Nobody tracks who holds administrator rights. This is the first question in any audit and one of the few with a genuinely quick answer available in Setup.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec10', t: 3, shape: 'polar',
          q: 'If you use Shield encryption, do you know what it stops working?',
          qr: {
            exec: 'If you encrypt fields, is it understood what that costs you in functionality?',
            admin: 'Were the filtering, sorting and search trade-offs of encrypting those fields chosen deliberately?'
          },
          help: 'Encrypted fields lose filtering, sorting and some search unless deterministic encryption is chosen for them.',
          opts: [
            { k: 'a', v: 3, label: 'No Shield encryption in use' },
            { k: 'b', v: 3, label: 'Yes, trade-offs were chosen deliberately' },
            { k: 'c', v: 1, label: 'Encryption is on, trade-offs unclear', fn: 'Encryption trade-offs unknown', flag: 'Fields are encrypted without the functional trade-offs being understood. Encryption silently removes filtering, sorting and some search — the usual discovery route is a report that cannot be built, diagnosed as a reporting bug.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec11', t: 3, shape: 'method',
          q: 'How are your encryption keys managed?',
          showIf: { q: 'sec10', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Customer-managed, rotated on a schedule' },
            { k: 'b', v: 2, label: 'Salesforce-managed, and understood' },
            { k: 'c', v: 1, label: 'Nobody knows', fn: 'Key management unowned', flag: 'Nobody owns encryption key management. Keys that are never rotated undercut most of the reason for encrypting, and an unowned key is one nobody can produce when an auditor asks.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'sec12', t: 3, shape: 'polar',
          q: 'Has your custom code been reviewed for security?',
          qr: {
            exec: 'Has anyone checked your custom code for security problems, as opposed to whether it works?'
          },
          help: 'Injection risks, and whether code enforces the sharing and field permissions the running user actually has.',
          showIf: { q: 'auto3', not: [3] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, against secure coding guidance' },
            { k: 'b', v: 2, label: 'Reviewed for function, not security' },
            { k: 'c', v: 1, label: 'Never', fn: 'Code never security-reviewed', flag: 'Custom code has never been reviewed for security. Apex runs in system context by default, so code that does not explicitly enforce sharing and field permissions quietly bypasses every access control configured around it.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ====================== PORTALS & EXTERNAL ACCESS =================== */
    {
      id: 'exp', title: 'Portals & external access', step: 'Set up',
      blurb: 'Anything customers or partners can reach — where a sharing mistake stops being internal.',
      questions: [
        {
          id: 'exp1', t: 3, shape: 'polar',
          q: 'Do you have any Experience Cloud sites or portals?',
          opts: [
            { k: 'a', v: 3, label: 'No external sites at all' },
            { k: 'b', v: 3, label: 'Yes, actively maintained' },
            { k: 'c', v: 1, label: 'Yes, but nobody really owns them', fn: 'Unowned external site', flag: 'An externally reachable site exists with no clear owner. Unowned public surfaces are where sharing mistakes stop being internal problems and become disclosures.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'exp2', t: 3, shape: 'polar',
          q: 'Has anyone reviewed what the guest user can see?',
          qr: {
            exec: 'Has anyone checked what a member of the public can reach through your Salesforce site without logging in?',
            admin: 'Have you audited guest user object and field access, and the sharing rules that grant it?'
          },
          help: 'Guest user over-permissioning is the most common cause of accidental public data exposure in Salesforce.',
          showIf: { q: 'exp1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, reviewed and locked down' },
            { k: 'b', v: 2, label: 'Reviewed at launch, not since' },
            { k: 'c', v: 0, label: 'Never reviewed', fn: 'Guest user access unreviewed', flag: 'Guest user access has never been audited. This is the single most common route to accidental public exposure of Salesforce data — worth checking this week, not this quarter, because anything reachable is reachable by anyone.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'exp3', t: 3, shape: 'polar',
          q: 'Is user-generated content on your site moderated?',
          showIf: { q: 'exp1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with rules and flagging' },
            { k: 'b', v: 2, label: 'Manually watched' },
            { k: 'c', v: 1, label: 'No moderation', fn: 'No content moderation', flag: 'External users can post without moderation. Beyond the obvious reputational risk, unmoderated sites accumulate spam that degrades search and support quality over time.' },
            { k: 'd', v: 3, label: 'No user-generated content' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ====================== COMMON — DATA QUALITY ====================== */
    {
      id: 'data', title: 'Data quality', step: 'Set up',
      blurb: 'Whether the numbers can be trusted.',
      questions: [
        {
          id: 'data1', t: 1, shape: 'degree',
          q: 'How bad is your duplicate problem?',
          qr: {
            user: 'How bad is duplication in the records you work with?',
            exec: 'How bad is duplication in your customer data?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Actively managed, rules in place' },
            { k: 'b', v: 2, label: 'Some duplicates, tolerable' },
            { k: 'c', v: 1, label: 'A known, unaddressed problem', fn: 'Duplicates unaddressed', flag: 'Duplicates are a known problem with no owner. They corrupt reporting, split activity history, and make one customer look like several smaller ones.' },
            { k: 'd', v: 0, label: 'Bad enough that people distrust the data', fn: 'Data trust lost', flag: 'Data quality has crossed the trust threshold. Once users distrust the system they keep private spreadsheets, and the org quietly stops being the source of truth.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'data2', t: 3, shape: 'polar',
          q: 'Does anyone own data quality?',
          qr: {
            user: 'If you spot bad data, is there someone whose job it is to fix it?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with dashboards' },
            { k: 'b', v: 2, label: 'Informally' },
            { k: 'c', v: 0, label: 'No', fn: 'No data quality owner', flag: 'No owner for data quality. It decays by default; it never improves on its own.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'data3', t: 3, shape: 'polar',
          q: 'Has data ever been migrated in from another system?',
          opts: [
            { k: 'a', v: 3, label: 'Yes, cleanly and documented' },
            { k: 'b', v: 2, label: 'Yes, with known compromises' },
            { k: 'c', v: 1, label: 'Yes, and it was messy', fn: 'Messy historical migration', flag: 'A messy historical migration leaves permanent artefacts — orphaned records, placeholder owners, dates that are not real. Worth identifying so reports can exclude them.' },
            { k: 'd', v: 3, label: 'No, never' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'data4', t: 3, shape: 'method',
          q: 'How is it decided which system owns which data?',
          qr: {
            exec: 'How is it decided which system wins when Salesforce and another disagree?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Clear, documented ownership per object' },
            { k: 'b', v: 2, label: 'Understood informally' },
            { k: 'c', v: 1, label: 'Depends who you ask', fn: 'System of record unclear', flag: 'Which system owns which data is not agreed. Integrations built on an unstated assumption about ownership overwrite each other, and the resulting conflicts get diagnosed as sync bugs rather than as design decisions nobody made.' },
            { k: 'd', v: 0, label: 'Nobody has ever decided', fn: 'No data ownership model', flag: 'Data ownership has never been decided. This is the root cause behind most recurring integration conflicts, and no amount of integration engineering fixes it.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'data5', t: 3, shape: 'location',
          q: 'Where do documents related to records actually live?',
          opts: [
            { k: 'a', v: 3, label: 'In Salesforce, or properly linked' },
            { k: 'b', v: 2, label: 'Mixed, mostly findable' },
            { k: 'c', v: 1, label: 'Scattered across drives and inboxes', fn: 'Documents scattered', flag: 'Record-related documents are scattered outside Salesforce. Contracts and signed agreements in particular become unfindable exactly when they are needed, which is usually during a dispute.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'data6', t: 3, shape: 'polar',
          q: 'Is Data Cloud in use, and does anyone own what it ingests?',
          opts: [
            { k: 'a', v: 3, label: 'Not in use' },
            { k: 'b', v: 3, label: 'In use, ingestion owned and reviewed' },
            { k: 'c', v: 1, label: 'In use, nobody really owns it', fn: 'Data Cloud unowned', flag: 'Data Cloud is ingesting without an owner. Consumption is metered, so an unowned pipeline is both a cost that grows on its own and a data set nobody is validating.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ====================== DATA VOLUME & PERFORMANCE =================== */
    {
      id: 'scale', title: 'Data volume & performance', step: 'Set up',
      blurb: 'What happens as the data grows — the problems that arrive quietly and all at once.',
      questions: [
        {
          id: 'scale1', t: 3, shape: 'polar',
          q: 'Do you have objects holding millions of records?',
          qr: {
            exec: 'Is any part of Salesforce holding a very large amount of data?'
          },
          opts: [
            { k: 'a', v: 3, label: 'No, nothing near that' },
            { k: 'b', v: 3, label: 'Yes, and performance is managed' },
            { k: 'c', v: 1, label: 'Yes, and things are slowing down', fn: 'Volume outpacing design', flag: 'Data volume has outgrown the original design. Salesforce degrades non-linearly at scale — queries that were instant stay instant until they abruptly are not, which is why this rarely gets attention until it is urgent.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'scale2', t: 3, shape: 'polar',
          q: 'Are the fields people filter and sort on indexed?',
          qr: {
            exec: 'Has anyone made sure the searches your teams run most are fast?'
          },
          help: 'Standard and custom indexes decide whether a filter reads a few rows or the whole table.',
          showIf: { q: 'scale1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, deliberately indexed' },
            { k: 'b', v: 2, label: 'Some are' },
            { k: 'c', v: 1, label: 'Nobody has looked', fn: 'Indexing unexamined', flag: 'Nobody has reviewed indexing against how people actually filter. This is usually the cheapest performance win available — often a support request rather than a project.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'scale3', t: 3, shape: 'degree',
          q: 'How often do reports or list views time out?',
          qr: {
            user: 'How often does a report or list view fail to load for you?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Never' },
            { k: 'b', v: 2, label: 'Occasionally, on the biggest reports' },
            { k: 'c', v: 1, label: 'Regularly', fn: 'Reports timing out', flag: 'Reports time out regularly. People respond by exporting to spreadsheets, which is how reporting quietly migrates out of Salesforce and stops being governed at all.' },
            { k: 'd', v: 0, label: 'Constantly — people avoid them', fn: 'Reporting unusable at volume', flag: 'Reporting is effectively unusable. Whatever the org was bought to provide, it is not currently providing it, and every workaround built around this makes the next fix harder.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'scale4', t: 3, shape: 'polar',
          q: 'Is old data archived out of the live org?',
          opts: [
            { k: 'a', v: 3, label: 'Yes, on a defined cycle' },
            { k: 'b', v: 2, label: 'Some archiving happens' },
            { k: 'c', v: 1, label: 'Everything stays live forever', fn: 'No archiving', flag: 'Nothing is ever archived. Every query, report and index carries the full history forever, so performance degrades on a schedule set by your own growth rather than by anything you chose.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ======================= COMMON — AUTOMATION ======================= */
    {
      id: 'auto', title: 'Automation', step: 'Set up',
      blurb: 'Flows, triggers and rules — where complexity compounds fastest.',
      questions: [
        {
          id: 'auto1', t: 1, shape: 'polar',
          q: 'Do you know everything that fires when a record is saved?',
          qr: {
            exec: 'Does anyone have a complete picture of what the system does automatically?',
            user: 'Is it clear to you what happens automatically when you save a record?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, mapped and documented' },
            { k: 'b', v: 2, label: 'Mostly' },
            { k: 'c', v: 0, label: 'No — genuinely no idea', fn: 'Automation is a black box', flag: 'Save-time behaviour is not mapped. Overlapping flows and triggers produce order-dependent bugs that are hard to reproduce and often misdiagnosed as user error. A read-only automation audit is the standard first step.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'auto2', t: 2, shape: 'method',
          q: 'What automation tools is your org built on?',
          qr: {
            exec: 'What automation tools is your org built on, including any Salesforce has retired?'
          },
          help: 'Workflow Rules and Process Builder are both retired — Salesforce has ended support.',
          opts: [
            { k: 'a', v: 3, label: 'Flow only' },
            { k: 'b', v: 2, label: 'Mostly Flow, some legacy' },
            { k: 'c', v: 1, label: 'A real mix', fn: 'Retired tools still running', flag: 'Retired automation tools are still running. Workflow Rules and Process Builder are past end of support — migration is no longer optional, only a question of whose schedule it happens on.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true, fn: 'Automation inventory unknown', flag: 'Automation inventory is unknown, including whether retired tools are still in use. This is a concrete, time-boxed audit.' }
          ]
        },
        {
          id: 'auto3', t: 3, shape: 'polar',
          q: 'Do you have Apex triggers or custom code?',
          qr: {
            exec: 'Is there custom-written code in your org, and does anyone maintain it?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with tests and documentation' },
            { k: 'b', v: 2, label: 'Yes, with passing tests' },
            { k: 'c', v: 1, label: 'Yes, and nobody understands it', fn: 'Unowned custom code', flag: 'Unowned Apex is present. Code nobody understands cannot be safely changed, so it gets worked around — which adds more code nobody understands.' },
            { k: 'd', v: 3, label: 'No custom code at all' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'auto4', t: 2, shape: 'method',
          q: 'When automation fails silently, how do you find out?',
          qr: {
            user: 'How would anyone notice if something stopped happening automatically?',
            exec: 'How would you find out if an automated process quietly stopped working?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Monitoring and alerts' },
            { k: 'b', v: 2, label: 'Error emails to an admin' },
            { k: 'c', v: 1, label: 'A user eventually reports it', fn: 'Failures found by users', flag: 'Failures surface only when a user notices. By then the bad data has usually propagated into reports and downstream systems.' },
            { k: 'd', v: 0, label: 'We probably do not', fn: 'Silent failures undetected', flag: 'Silent failures go undetected — the single most common source of "the numbers were wrong for months and nobody knew".' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'auto5', t: 3, shape: 'polar',
          q: 'Do your automations have error handling?',
          qr: {
            admin: 'Do your flows have fault paths, or do they just stop when something goes wrong?',
            exec: 'When an automated process fails halfway, does it leave a mess someone has to clean up?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with fault paths and alerts' },
            { k: 'b', v: 2, label: 'On the important ones' },
            { k: 'c', v: 1, label: 'Mostly not', fn: 'No error handling', flag: 'Automations lack fault handling. A flow that fails halfway leaves records in a state the process never anticipated, and those partial records are then treated as real data by everything downstream.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'auto6', t: 3, shape: 'polar',
          q: 'Do you have legacy features still switched on that nobody uses?',
          help: 'Solutions, Ideas, Chatter groups, old Visualforce pages, retired managed packages.',
          opts: [
            { k: 'a', v: 3, label: 'Reviewed and cleaned up' },
            { k: 'b', v: 2, label: 'Some, known about' },
            { k: 'c', v: 1, label: 'Certainly, never audited', fn: 'Legacy features unaudited', flag: 'Retired features and packages are still enabled. Each one is surface area to secure, upgrade and test, delivering nothing — and managed packages in particular can block deployments long after anyone stopped using them.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ====================== COMMON — INTEGRATION ======================= */
    {
      id: 'intg', title: 'Integration', step: 'Set up',
      blurb: 'What Salesforce talks to, and what happens when that conversation fails.',
      questions: [
        {
          id: 'intg1', t: 2, shape: 'count',
          q: 'How many external systems exchange data with Salesforce?',
          qr: {
            user: 'How many other systems does Salesforce share data with?'
          },
          opts: [
            { k: 'a', v: 3, label: 'None' },
            { k: 'b', v: 3, label: 'One or two, well understood' },
            { k: 'c', v: 2, label: 'Three to five' },
            { k: 'd', v: 1, label: 'Many, built at different times', fn: 'Fragmented integration estate', flag: 'Multiple integrations built independently. Without a shared error-handling and retry pattern each fails differently and each needs separate debugging knowledge.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'intg2', t: 2, shape: 'degree',
          q: 'If an integration stopped working, how long until someone noticed?',
          qr: {
            exec: 'If data stopped flowing between systems, how quickly would you know?'
          },
          showIf: { q: 'intg1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Minutes — we alert on it' },
            { k: 'b', v: 2, label: 'Within a day' },
            { k: 'c', v: 1, label: 'Days or weeks', fn: 'Slow failure detection', flag: 'Integration failures go unnoticed for days. Silent partial sync is worse than a hard outage, because the data looks complete and is not.' },
            { k: 'd', v: 0, label: 'Only when something looks wrong downstream', fn: 'No integration monitoring', flag: 'No integration monitoring. Recovery also tends to be undefined — knowing what to replay after an outage matters as much as the alert.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'intg3', t: 3, shape: 'polar',
          q: 'Are integration credentials managed properly?',
          qr: {
            exec: 'Are the passwords and keys connecting your systems stored securely?'
          },
          help: 'Named Credentials and External Credentials, rather than secrets in code or custom settings.',
          showIf: { q: 'intg1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Named Credentials throughout' },
            { k: 'b', v: 2, label: 'Mostly' },
            { k: 'c', v: 0, label: 'Secrets sit in settings or code', fn: 'Credentials stored unsafely', flag: 'Credentials stored outside Named Credentials. This is a genuine security finding and will be raised in any serious security review.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'intg4', t: 3, shape: 'polar',
          q: 'Do your integrations use dedicated accounts?',
          qr: {
            exec: 'Do the connections between your systems run under a real employee’s login?',
            admin: 'Does any integration authenticate as a named human user?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, dedicated integration users' },
            { k: 'b', v: 2, label: 'Mostly' },
            { k: 'c', v: 0, label: 'They run as a person’s account', fn: 'Integration on a human account', flag: 'At least one integration authenticates as a named person. When that person leaves and their account is deactivated, the integration dies with no warning — and until then, every record it touches is attributed to someone who did not touch it.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'intg5', t: 3, shape: 'polar',
          q: 'Do you know how much of your API allowance you use?',
          showIf: { q: 'intg1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Monitored, with headroom' },
            { k: 'b', v: 2, label: 'Checked occasionally' },
            { k: 'c', v: 1, label: 'Never looked', fn: 'API usage unmonitored', flag: 'API consumption is not monitored. Hitting the limit does not degrade gracefully — integrations simply start failing, usually at month end when volume peaks and attention is elsewhere.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'intg6', t: 3, shape: 'method',
          q: 'How were your integrations designed?',
          qr: {
            exec: 'How were your system connections designed — to a plan, or one at a time?'
          },
          showIf: { q: 'intg1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'To a documented pattern' },
            { k: 'b', v: 2, label: 'Consistently, though informally' },
            { k: 'c', v: 1, label: 'Each one bespoke', fn: 'No integration pattern', flag: 'Every integration was designed independently. Each then fails differently, needs its own debugging knowledge, and the person who understands one rarely understands the next.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'intg7', t: 3, shape: 'polar',
          q: 'Do users ever wait on an integration to finish?',
          qr: {
            user: 'Does saving a record ever hang while something else happens?'
          },
          help: 'Synchronous callouts inside a save block the user and sit under strict platform limits.',
          showIf: { q: 'intg1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'No, anything slow runs asynchronously' },
            { k: 'b', v: 2, label: 'Occasionally' },
            { k: 'c', v: 1, label: 'Yes, regularly', fn: 'Synchronous integration blocking users', flag: 'Users wait on integrations mid-save. Beyond the daily friction, synchronous callouts sit under hard platform limits, so this fails outright under load rather than merely feeling slow.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ======================== COMMON — RELEASE ========================= */
    {
      id: 'rel', title: 'Release & environments', step: 'Set up',
      blurb: 'How change reaches production. The honest answer here saves the most money later.',
      questions: [
        {
          id: 'rel1', t: 1, shape: 'method',
          q: 'How do changes get to production?',
          qr: {
            exec: 'How do changes get made and released?',
            user: 'How do changes to Salesforce reach you?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Source control and CI/CD' },
            { k: 'b', v: 2, label: 'Tested first, then released by hand' },
            { k: 'c', v: 0, label: 'Mostly built directly in production', fn: 'Changes made in production', flag: 'Changes are made directly in production. There is no way to test safely and no way to roll back — every change is a live experiment on your users.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'rel2', t: 3, shape: 'polar',
          q: 'Do you have a sandbox that resembles production?',
          qr: {
            exec: 'Is there a copy of the system where changes can be tried safely?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, refreshed regularly' },
            { k: 'b', v: 2, label: 'Yes, but stale' },
            { k: 'c', v: 1, label: 'One with no real data', fn: 'No representative test env', flag: 'No representative test environment. Bugs that only appear at production data volumes will reach users first.' },
            { k: 'd', v: 0, label: 'No sandbox', fn: 'No sandbox at all', flag: 'No sandbox exists, so there is nowhere to try a change before your users experience it.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'rel3', t: 3, shape: 'polar',
          q: 'Is your configuration in version control or backed up?',
          qr: {
            exec: 'If someone deleted something important, could you get it back?'
          },
          showIf: { q: 'rel1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, kept current' },
            { k: 'b', v: 2, label: 'Backed up, not versioned' },
            { k: 'c', v: 0, label: 'Neither', fn: 'No version control or backup', flag: 'No version control and no backup. Recovery from a bad change or accidental deletion depends on Salesforce support and a lot of luck, and there is no history of who changed what.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ======================== COMMON — ADOPTION ======================== */
    {
      id: 'adopt', title: 'Adoption & training', step: 'Engage',
      blurb: 'Whether people actually use it. The guide devoted a whole step to this, correctly.',
      questions: [
        {
          id: 'adopt1', t: 2, shape: 'polar',
          q: 'Do you track whether people are actually logging in and using it?',
          qr: {
            user: 'Does anyone check whether your team is actually using Salesforce?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with adoption dashboards' },
            { k: 'b', v: 2, label: 'Occasionally check' },
            { k: 'c', v: 0, label: 'No', fn: 'Adoption not measured', flag: 'Adoption is not measured. Without usage data you cannot tell whether a feature is unused because it is bad or because nobody knows it exists.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt2', t: 3, shape: 'method',
          q: 'How are new users trained?',
          qr: {
            user: 'How were you shown how to use Salesforce?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Structured onboarding with materials' },
            { k: 'b', v: 2, label: 'Informal walkthrough' },
            { k: 'c', v: 1, label: 'They figure it out', fn: 'No structured onboarding', flag: 'No structured onboarding. New users invent their own conventions — a steady source of the data-quality problems that surface later.' },
            { k: 'd', v: 0, label: 'They do not', fn: 'No training at all', flag: 'New users receive no training. Expect the data model to be interpreted differently by every cohort of hires.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt3', t: 3, shape: 'polar',
          q: 'Is there a route to request changes or report problems?',
          qr: {
            user: 'If Salesforce is getting in your way, is there somewhere to say so?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with visible triage' },
            { k: 'b', v: 2, label: 'Informally, via the admin' },
            { k: 'c', v: 0, label: 'Not really', fn: 'No feedback route', flag: 'No feedback route. Users stop reporting problems they believe nobody will fix, so the org looks healthier than it is.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt4', t: 1, shape: 'polar',
          q: 'Do people keep important data in spreadsheets outside Salesforce?',
          qr: {
            user: 'Do you keep your own spreadsheet because Salesforce does not do what you need?',
            exec: 'Do your teams keep important numbers in spreadsheets outside Salesforce?'
          },
          opts: [
            { k: 'a', v: 3, label: 'No' },
            { k: 'b', v: 2, label: 'A little' },
            { k: 'c', v: 1, label: 'Yes, commonly', fn: 'Shadow spreadsheets', flag: 'Shadow spreadsheets are in regular use. Each marks something Salesforce was expected to do and does not — they are a useful map of what to fix first.' },
            { k: 'd', v: 0, label: 'The real numbers live in spreadsheets', fn: 'Spreadsheet is system of record', flag: 'The system of record is effectively a spreadsheet. Treat as the headline finding: everything else is secondary to closing that gap.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt5', t: 3, shape: 'polar',
          q: 'Is everyone on Lightning Experience?',
          qr: {
            exec: 'Is everyone on the current Salesforce interface?',
            user: 'Is everyone you work with on the current Salesforce interface?'
          },
          help: 'Salesforce Classic receives no new features. Staying on it caps what can be built for those users.',
          opts: [
            { k: 'a', v: 3, label: 'Yes, fully on Lightning' },
            { k: 'b', v: 2, label: 'Mostly, a few holdouts' },
            { k: 'c', v: 1, label: 'Split between both', fn: 'Split across two interfaces', flag: 'Users are split across Classic and Lightning. Every feature then has to be built, tested and trained twice, and the Classic half quietly misses anything released in the last several years.' },
            { k: 'd', v: 0, label: 'Still largely on Classic', fn: 'Still on Salesforce Classic', flag: 'Largely still on Classic. No new Salesforce capability reaches these users, so the gap widens every release whether or not anything else changes.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt6', t: 3, shape: 'polar',
          q: 'Is Salesforce connected to the email and calendar people actually use?',
          qr: {
            user: 'Do you have to copy things between your email and Salesforce by hand?',
            exec: 'Does customer correspondence end up in Salesforce, or stay in individual inboxes?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, and people use it' },
            { k: 'b', v: 2, label: 'Available, patchily adopted' },
            { k: 'c', v: 1, label: 'Not connected', fn: 'Email not integrated', flag: 'Email and calendar are not connected to Salesforce, so customer correspondence lives in individual inboxes. The activity history that makes account handover possible is being lost daily.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt7', t: 3, shape: 'polar',
          q: 'Can people do their job on mobile?',
          qr: {
            user: 'Can you do what you need from your phone, or do you wait until you are at a desk?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, deliberately designed for it' },
            { k: 'b', v: 2, label: 'Works, not optimised' },
            { k: 'c', v: 1, label: 'Technically available, unusable', fn: 'Mobile unusable', flag: 'Mobile access exists but is not usable in practice. For field-facing teams this is the difference between data captured at the moment of truth and data reconstructed from memory that evening.' },
            { k: 'd', v: 3, label: 'Not relevant — desk-based team' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'adopt8', t: 3, shape: 'method',
          q: 'How do you handle the three Salesforce releases each year?',
          qr: {
            exec: 'How do you prepare for the three Salesforce releases each year?',
            admin: 'How do you test each seasonal release before it reaches production?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Tested in preview, communicated' },
            { k: 'b', v: 2, label: 'Read the notes, no testing' },
            { k: 'c', v: 1, label: 'We find out when things change', fn: 'Releases untested', flag: 'Seasonal releases arrive untested. Three times a year the platform changes underneath you with a month of advance warning that is going unused — and the preview sandbox that would catch it is free.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ====================== AI & AUTOMATION TRUST ======================= */
    {
      id: 'ai', title: 'AI & automation trust', step: 'Engage',
      blurb: 'Whether the AI features in play are grounded in data you would stand behind.',
      questions: [
        {
          id: 'ai1', t: 3, shape: 'polar',
          q: 'Are you using Salesforce AI features?',
          opts: [
            { k: 'a', v: 3, label: 'No, none enabled' },
            { k: 'b', v: 3, label: 'Yes, deliberately and scoped' },
            { k: 'c', v: 2, label: 'Yes, mostly the defaults' },
            { k: 'd', v: 1, label: 'Enabled, but nobody decided to', fn: 'AI enabled by default', flag: 'AI features are on because they shipped on, not because anyone chose them. Defaults decide what data is used and who sees the output — worth an explicit decision rather than an inherited one.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'ai2', t: 3, shape: 'polar',
          q: 'Do you know what data grounds your AI outputs?',
          qr: {
            exec: 'If an AI-generated summary were wrong, could you find out why?',
            admin: 'Do you know which fields and records your prompt templates actually read?'
          },
          showIf: { q: 'ai1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, prompts and sources documented' },
            { k: 'b', v: 2, label: 'Roughly' },
            { k: 'c', v: 1, label: 'No', fn: 'AI grounding unknown', flag: 'Nobody knows what data grounds the AI output. That makes wrong answers impossible to diagnose, and it means data-quality problems elsewhere in the org now surface as confident prose rather than as obviously blank fields.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'ai3', t: 3, shape: 'polar',
          q: 'Do people trust the AI suggestions they are shown?',
          qr: {
            user: 'Do you find the AI suggestions useful, or do you ignore them?'
          },
          showIf: { q: 'ai1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, they are used' },
            { k: 'b', v: 2, label: 'Mixed' },
            { k: 'c', v: 1, label: 'Mostly ignored', fn: 'AI output ignored', flag: 'AI suggestions are ignored. That is usually a data-quality symptom rather than a model problem — the feature is faithfully reflecting an org nobody has cleaned up.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'ai4', t: 3, shape: 'polar',
          q: 'Do your agents have defined limits on what they will handle?',
          qr: {
            exec: 'Is it clear what your AI agents will and will not do on your behalf?'
          },
          help: 'Topics and guardrails decide the boundary. Without them an agent attempts whatever it is asked.',
          showIf: { q: 'ai1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, topics and guardrails defined' },
            { k: 'b', v: 2, label: 'Broadly scoped' },
            { k: 'c', v: 1, label: 'It attempts whatever it is asked', fn: 'Agent scope undefined', flag: 'The agent has no defined boundary, so it will attempt questions nobody designed it for. Customer-facing agents fail publicly, and the first time is usually the first anyone notices the scope was never set.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'ai5', t: 3, shape: 'method',
          q: 'How does an agent hand off when it cannot help?',
          qr: {
            exec: 'How does a customer reach a person when the AI cannot help them?'
          },
          showIf: { q: 'ai1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Defined escalation to a person' },
            { k: 'b', v: 2, label: 'Escalates, sometimes clumsily' },
            { k: 'c', v: 1, label: 'It keeps trying', fn: 'No escalation path', flag: 'There is no clean handoff when the agent cannot help. A customer trapped in a loop with an agent is a worse experience than no agent at all, and it is the interaction most likely to be screenshotted.' },
            { k: 'd', v: 0, label: 'It simply stops', fn: 'Agent dead-ends', flag: 'The conversation dead-ends with no route to a person. Every one of those is a customer who came for help and was refused by a system nobody told them how to escape.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'ai6', t: 3, shape: 'polar',
          q: 'Are agent responses tested before customers see them?',
          showIf: { q: 'ai1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, against a test set before each change' },
            { k: 'b', v: 2, label: 'Spot-checked' },
            { k: 'c', v: 1, label: 'Not really', fn: 'Agent changes untested', flag: 'Agent behaviour changes reach customers untested. Unlike a flow, a prompt change can alter behaviour in ways nobody predicted from reading it — testing is the only way to know what you shipped.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'ai7', t: 3, shape: 'polar',
          q: 'Does anyone review what your agents actually said?',
          qr: {
            exec: 'Does anyone read back what the AI has been telling your customers?'
          },
          showIf: { q: 'ai1', not: [0] },
          opts: [
            { k: 'a', v: 3, label: 'Yes, conversations reviewed routinely' },
            { k: 'b', v: 2, label: 'Occasionally sampled' },
            { k: 'c', v: 0, label: 'No', fn: 'Agent output unreviewed', flag: 'Nobody reads what the agent says. Its answers are your answers as far as a customer is concerned, and problems surface as complaints rather than as findings.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    },

    /* ====================== GOVERNANCE & CHANGE CONTROL ================= */
    {
      id: 'gov', title: 'Governance & change control', step: 'Engage',
      blurb: 'How decisions get made and recorded, as opposed to how changes get deployed.',
      questions: [
        {
          id: 'gov1', t: 3, shape: 'polar',
          q: 'Is there a process for deciding what gets built?',
          qr: {
            exec: 'Is there a defensible process for prioritising Salesforce work, or does it go to whoever asks loudest?',
            admin: 'Do requests reach you through a process, or as messages from whoever thought of it?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, with visible prioritisation' },
            { k: 'b', v: 2, label: 'Informal but consistent' },
            { k: 'c', v: 1, label: 'Whoever asks loudest', fn: 'No prioritisation process', flag: 'Work is prioritised by volume of asking rather than by value. The predictable result is an org shaped by the most persistent stakeholder rather than the most important use case.' },
            { k: 'd', v: 0, label: 'No process at all', fn: 'No governance', flag: 'There is no process for deciding what gets built. Every request becomes a negotiation, and nothing is ever formally declined — which is how orgs accumulate features nobody uses.' },
            { k: 'e', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'gov2', t: 3, shape: 'polar',
          q: 'Do you have a data retention or archiving policy?',
          qr: {
            exec: 'Do you know how long customer data stays in Salesforce, and whether that matches what you told customers?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, defined and applied' },
            { k: 'b', v: 2, label: 'Defined, applied inconsistently' },
            { k: 'c', v: 1, label: 'Nothing is ever deleted', fn: 'No retention policy', flag: 'Nothing is ever deleted. Beyond storage cost, indefinite retention conflicts with most privacy notices and turns a future breach into a far larger disclosure than it needed to be.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'gov3', t: 3, shape: 'polar',
          q: 'Is anyone watching how close you are to org limits?',
          qr: {
            exec: 'Could you be surprised by hitting a Salesforce storage or licence limit?',
            admin: 'Do you track data storage, API usage and licence headroom before they become urgent?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Yes, monitored routinely' },
            { k: 'b', v: 2, label: 'Checked occasionally' },
            { k: 'c', v: 1, label: 'Only when something fails', fn: 'Limits unmonitored', flag: 'Org limits are noticed only when something breaks. Storage and API ceilings are entirely predictable and give plenty of warning to anyone actually looking.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        },
        {
          id: 'gov4', t: 3, shape: 'degree',
          q: 'How closely do your licence numbers match actual usage?',
          qr: {
            exec: 'How closely do your licence numbers match the people actually using Salesforce?'
          },
          opts: [
            { k: 'a', v: 3, label: 'Reviewed at each renewal' },
            { k: 'b', v: 2, label: 'Roughly right' },
            { k: 'c', v: 1, label: 'Almost certainly, yes', fn: 'Unused licences', flag: 'Licences are likely being paid for without being used. Login history makes this a same-day answer, and it is one of the few findings that pays for the work of finding it.' },
            { k: 'd', v: 1, label: 'Not sure', unsure: true }
          ]
        }
      ]
    }
  ],

  /* Closing context. Multiple choice, not free text, so state stays compact. */
  context: [
    {
      id: 'ctx1', q: 'What prompted you to look at this now?',
      opts: [
        { k: 'a', label: 'Something specific broke' },
        { k: 'b', label: 'A renewal or budget decision' },
        { k: 'c', label: 'An audit or compliance requirement' },
        { k: 'd', label: 'New leadership, or a new hire asking questions' },
        { k: 'e', label: 'Considering a change of partner' },
        { k: 'f', label: 'General unease, nothing specific' }
      ]
    },
    {
      id: 'ctx2', q: 'If one thing were fixed tomorrow, what would you pick?',
      opts: [
        { k: 'a', label: 'Reporting I can trust' },
        { k: 'b', label: 'Automation that stops breaking' },
        { k: 'c', label: 'Data quality' },
        { k: 'd', label: 'Getting changes made faster' },
        { k: 'e', label: 'People actually using it' },
        { k: 'f', label: 'Security and access' },
        { k: 'g', label: 'Integrations that stay up' },
        { k: 'h', label: 'Understanding what we already have' }
      ]
    },
    {
      id: 'ctx3', q: 'How soon does this need attention?',
      opts: [
        { k: 'a', label: 'Something is broken now' },
        { k: 'b', label: 'This quarter' },
        { k: 'c', label: 'Planning ahead' },
        { k: 'd', label: 'Just gathering information' }
      ]
    }
  ]
};
