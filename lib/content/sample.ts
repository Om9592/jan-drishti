import type {
  Article,
  Category,
  Correction,
  FactCheck,
  FeedSource,
  Submission,
  EditorialUser,
  AuditLogEntry,
} from "@/lib/types";

/**
 * SAMPLE CONTENT — development / preview only.
 *
 * Nothing in this file describes a real-world event, and nothing here is
 * presented as verified journalism. Every record carries `isSample: true`
 * and the UI renders a visible "Sample content" marker. When Firestore is
 * configured (`isFirebaseConfigured`), the application reads from Firestore
 * instead and this file is not used.
 *
 * The sample pieces are deliberately about *how we work* — methodology,
 * data literacy, corrections — so that no fabricated news event is ever
 * dressed up as reporting.
 */

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

export const SAMPLE_CATEGORIES: Category[] = [
  { id: "cat-india", slug: "india", nameEn: "India", nameHi: "भारत", order: 1, showOnHome: true, descriptionEn: "Policy, institutions and the everyday state.", descriptionHi: "नीति, संस्थाएँ और रोज़मर्रा का राज्य।" },
  { id: "cat-politics", slug: "politics", nameEn: "Politics & Governance", nameHi: "राजनीति और शासन", order: 2, showOnHome: true, descriptionEn: "Elections, legislatures and accountability.", descriptionHi: "चुनाव, विधानमंडल और जवाबदेही।" },
  { id: "cat-economy", slug: "economy", nameEn: "Economy & Employment", nameHi: "अर्थव्यवस्था और रोज़गार", order: 3, showOnHome: true, descriptionEn: "Work, wages, prices and public finance.", descriptionHi: "काम, मज़दूरी, कीमतें और सार्वजनिक वित्त।" },
  { id: "cat-education", slug: "education", nameEn: "Education", nameHi: "शिक्षा", order: 4, showOnHome: true, descriptionEn: "Schools, universities and learning outcomes.", descriptionHi: "स्कूल, विश्वविद्यालय और सीखने के परिणाम।" },
  { id: "cat-health", slug: "health", nameEn: "Healthcare", nameHi: "स्वास्थ्य", order: 5, showOnHome: true, descriptionEn: "Hospitals, public health and access.", descriptionHi: "अस्पताल, जनस्वास्थ्य और पहुँच।" },
  { id: "cat-states", slug: "states", nameEn: "States", nameHi: "राज्य", order: 6, showOnHome: true, descriptionEn: "Reporting from India's districts and states.", descriptionHi: "भारत के ज़िलों और राज्यों से रिपोर्टिंग।" },
  { id: "cat-ground", slug: "ground-reports", nameEn: "Ground Reports", nameHi: "ज़मीनी रिपोर्ट", order: 7, showOnHome: true, descriptionEn: "Original reporting from the field.", descriptionHi: "मैदान से मौलिक रिपोर्टिंग।" },
  { id: "cat-factcheck", slug: "fact-check", nameEn: "Fact Check", nameHi: "फ़ैक्ट चेक", order: 8, showOnHome: true, descriptionEn: "Viral claims, traced to evidence.", descriptionHi: "वायरल दावे, प्रमाण तक।" },
  { id: "cat-environment", slug: "environment", nameEn: "Environment", nameHi: "पर्यावरण", order: 9, showOnHome: true, descriptionEn: "Climate, water, air and land.", descriptionHi: "जलवायु, जल, वायु और भूमि।" },
  { id: "cat-science", slug: "science", nameEn: "Science", nameHi: "विज्ञान", order: 10, showOnHome: false, descriptionEn: "Research, health science and space.", descriptionHi: "अनुसंधान, स्वास्थ्य विज्ञान और अंतरिक्ष।" },
  { id: "cat-tech", slug: "technology", nameEn: "Technology", nameHi: "तकनीक", order: 11, showOnHome: false, descriptionEn: "Platforms, data and digital rights.", descriptionHi: "प्लेटफ़ॉर्म, डेटा और डिजिटल अधिकार।" },
];

const SOURCE_DESK = {
  id: "src-desk",
  name: "Jan Drishti newsroom",
  url: "/about",
  publisher: "Jan Drishti",
  type: "primary_record" as const,
  isPrimary: true,
  note: "Internal editorial record.",
};

export const SAMPLE_ARTICLES: Article[] = [
  {
    id: "art-verification",
    slug: "how-jan-drishti-verifies-a-viral-claim",
    title: "How Jan Drishti verifies a viral claim, step by step",
    subtitle:
      "Six evidence steps, one named editor, and a rule we do not bend: no verdict without a source you can open yourself.",
    summary:
      "A walkthrough of the verification file our researchers build before any verdict is published — from claim extraction to the editor's signature.",
    content: `
<p>Most viral claims arrive as a screenshot with no date, no author and no original link. Our job is to rebuild that missing context, and to show our work while doing it.</p>
<p>This page is a sample of the reporting layer of Jan Drishti. It is here so you can see how a live report will be structured: a claim you can read in its original form, an evidence file you can open, and a verdict signed by a person whose name you know.</p>
<h2>1. We record the claim exactly as it reached the reader</h2>
<p>Forwarded text is captured verbatim, including spelling errors, because small changes in wording often reveal how a claim mutated as it travelled. If a screenshot is submitted, we run OCR and keep the extracted text beside the image, so the two can be compared.</p>
<h2>2. We separate facts from opinion</h2>
<p>A forward usually mixes a checkable statement ("the fee was raised on 1 April") with a judgement ("this government hates students"). Only the first can be verified. We list each factual claim separately and mark the rest as commentary.</p>
<h2>3. We look for the primary document</h2>
<p>Gazette notifications, court orders, budget documents, tender notices and official press releases come first. A claim is not false because a minister denies it, and not true because a channel reported it. Primary records outrank summaries, always.</p>
<h2>4. We search for contradiction, not confirmation</h2>
<p>After assembling supporting evidence, a researcher is required to spend equal effort looking for material that undermines the claim. Both sets appear in the published report, side by side.</p>
<h2>5. We name what is missing</h2>
<p>Many claims are technically accurate and still misleading: a two-year-old photograph, a state scheme described as national, a partial quotation. "Missing context" is a required field in every report.</p>
<h2>6. An editor signs the verdict</h2>
<p>AI-assisted research is labelled preliminary in our system and cannot be published. A named editor reviews the file, may reject it, and only then does a verdict appear on the site.</p>
<blockquote>If we cannot open a source and read it ourselves, it does not go in the report.</blockquote>
<p>When the evidence is thin, the verdict is UNVERIFIED. That is a legitimate outcome, not a failure — and we publish it with the same prominence as any other finding.</p>
`,
    language: "en",
    categoryId: "cat-factcheck",
    authorId: "auth-desk",
    authorName: "Jan Drishti Editorial Desk",
    imageUrl: "/images/verification-desk.svg",
    imageCaption: "An evidence file is assembled by hand before any verdict is published.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "explainer",
    featured: true,
    publishedAt: hoursAgo(3),
    updatedAt: hoursAgo(2),
    readingMinutes: 6,
    tags: ["methodology", "fact check", "transparency"],
    sources: [SOURCE_DESK],
    isSample: true,
    seoTitle: "How Jan Drishti verifies a viral claim, step by step",
    seoDescription:
      "Inside the six-step verification process behind every Jan Drishti fact-check verdict — and why no algorithm can publish one.",
  },
  {
    id: "art-data",
    slug: "what-official-data-can-and-cannot-tell-you",
    title: "What official data can tell you — and what it quietly leaves out",
    subtitle:
      "Every statistic arrives with a definition, a survey design and a gap. Reading all three is the difference between a finding and a headline.",
    summary:
      "A practical guide to reading Indian official statistics without over-claiming: base years, sample design, revision cycles and the numbers that never get published.",
    content: `
<p>Numbers are the most quoted and least examined part of Indian public debate. A single figure can travel across every channel in a day; the methodology note that qualifies it rarely travels at all.</p>
<p>This sample piece demonstrates how our economy desk writes an explainer: no claim without the survey it came from, no comparison without matching definitions, and a clear line between what the data shows and what it does not.</p>
<h2>Ask what was measured</h2>
<p>"Unemployment" in one release may mean usual status in a periodic labour force survey; in another, it may mean a week-long reference period in a private estimate. Two numbers with the same label can describe different populations entirely.</p>
<h2>Ask who was asked</h2>
<p>Sample size, sampling frame and response rates determine how much a figure can bear. A survey of 4,000 households can support a national direction; it cannot support a claim about one ward.</p>
<h2>Ask when it was revised</h2>
<p>Estimates get revised, sometimes by more than the change a headline described. We date-stamp every figure with the release it came from, and we say when a later revision changed the picture.</p>
<h2>Say plainly what is unknown</h2>
<p>The most useful sentence in a data story is often "this release does not tell us that". We would rather publish a narrower finding we can defend than a sweeping one we cannot.</p>
`,
    language: "en",
    categoryId: "cat-economy",
    authorId: "auth-econ",
    authorName: "Sample Desk — Economy",
    imageUrl: "/images/data-desk.svg",
    imageCaption: "Definitions travel less widely than the numbers they produce.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "explainer",
    featured: true,
    publishedAt: hoursAgo(7),
    updatedAt: hoursAgo(6),
    readingMinutes: 5,
    tags: ["data", "economy", "explainer"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
  {
    id: "art-ground",
    slug: "inside-a-ground-report-three-sources-one-district",
    title: "Inside a ground report: three sources, one district, no shortcuts",
    subtitle: "What it actually takes to stand in a queue, count the people in it, and write down what they say.",
    summary:
      "A sample ground report showing our field method: verify the location, record people in their own words, and separate what we saw from what we were told.",
    content: `
<p>Ground reporting is expensive and slow, which is why so much of it has been replaced by aggregation. We still think a reporter standing in the room is the only way to know what the room looks like.</p>
<p>Our field method has three rules. Confirm the place and date with a geotagged photograph and a document that ties the location to the story. Speak to people who disagree with each other. And write down the difference between what you saw yourself and what a source told you.</p>
<h2>Counting is reporting</h2>
<p>If a report says a queue was long, we count it, note the time, and describe the conditions. If an official says a scheme reached everyone, we ask for the list and try to find the people who are not on it.</p>
<h2>Consent and safety</h2>
<p>People who speak to us about their entitlements can face consequences. We explain what publication means, we use first names where full names would expose someone, and we never publish a location that could identify a vulnerable source.</p>
<h2>What a sample report looks like</h2>
<p>This entry exists so the section has a complete, correctly labelled example. In production this slot is filled only by a reporter who filed from the field, with the datelines and documents attached.</p>
`,
    language: "en",
    categoryId: "cat-ground",
    authorId: "auth-field",
    authorName: "Sample Desk — Field Reporting",
    imageUrl: "/images/ground-report.svg",
    imageCaption: "Field notes are photographed and filed with the story.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "original",
    groundReport: true,
    underreported: true,
    publishedAt: hoursAgo(19),
    updatedAt: hoursAgo(19),
    readingMinutes: 7,
    tags: ["ground report", "method"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
  {
    id: "art-corrections",
    slug: "why-corrections-sit-at-the-top-of-the-story",
    title: "Why corrections sit at the top of the story, not the bottom",
    subtitle: "A correction nobody scrolls to is not a correction. It is a footnote.",
    summary:
      "Our corrections policy, in plain language: what we fix, how fast, and why the notice stays visible on the article permanently.",
    content: `
<p>When we get something wrong, the record has to change in the place where the error was read. That means a visible notice near the top of the article, a dated entry in the correction log, and a version bump that readers can see.</p>
<h2>What counts as a correction</h2>
<p>Anything material: a wrong number, a misattributed quote, a misidentified person, a date that changes the meaning of a story. Minor typography is fixed silently; meaning is never fixed silently.</p>
<h2>How fast</h2>
<p>We aim to publish a correction within 24 hours of confirming an error. If we are still checking, we say so on the story rather than leaving an unchallenged error live.</p>
<h2>Who can ask</h2>
<p>Anyone. Use the <a href="/submit?type=correction">correction request form</a> and link the passage you believe is wrong. You do not need an account, and you do not need to be the subject of the story.</p>
<h2>The log is permanent</h2>
<p>Corrections are never deleted. The <a href="/corrections">corrections page</a> lists every notice with its date and severity, including the ones that make us look bad.</p>
`,
    language: "en",
    categoryId: "cat-india",
    authorId: "auth-desk",
    authorName: "Jan Drishti Editorial Desk",
    imageUrl: "/images/corrections.svg",
    imageCaption: "Corrections are logged, dated and left visible.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "explainer",
    publishedAt: hoursAgo(30),
    updatedAt: hoursAgo(28),
    readingMinutes: 4,
    tags: ["corrections", "transparency"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
  {
    id: "art-press-release",
    slug: "reading-a-government-press-release-critically",
    title: "Reading a government press release critically: a five-minute checklist",
    subtitle: "Four questions that separate an announcement from a delivery.",
    summary:
      "Announcements, approvals and disbursements are three different things. A short checklist for readers who want to know which one they are looking at.",
    content: `
<p>A press release is a primary source, but it is a primary source about what an institution says — not proof that anything has happened on the ground. Both readings matter, and conflating them is how announcements become "schemes".</p>
<h2>Was it announced, approved, notified or disbursed?</h2>
<p>Each stage has a different document: a speech, a cabinet decision, a gazette notification, a treasury release. We cite the stage, because a promise and a payment are not the same fact.</p>
<h2>Whose number is it?</h2>
<p>Beneficiary counts are frequently cumulative and sometimes projected. Look for the reference period and whether the figure is a target or an outcome.</p>
<h2>What is the geography?</h2>
<p>A state pilot described as a national programme is one of the most common misleading patterns we see. Check the jurisdiction named in the order, not the headline of the release.</p>
<h2>Who is not mentioned?</h2>
<p>Every scheme has people it does not reach. The absence of any limitation, grievance or exclusion figure is itself information about the document.</p>
`,
    language: "en",
    categoryId: "cat-politics",
    authorId: "auth-desk",
    authorName: "Jan Drishti Editorial Desk",
    imageUrl: "/images/press-release.svg",
    imageCaption: "The stage of a decision changes what the document proves.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "explainer",
    publishedAt: daysAgo(2),
    updatedAt: daysAgo(2),
    readingMinutes: 5,
    tags: ["governance", "media literacy"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
  {
    id: "art-forward",
    slug: "anatomy-of-a-misleading-forward",
    title: "The anatomy of a misleading forward: five patterns we see most",
    subtitle: "Old photographs, cropped documents, borrowed authority, missing denominators, and the quote nobody said.",
    summary:
      "Most misinformation is not invented from nothing. It is real material, rearranged. Here are the five rearrangements that account for most viral claims.",
    content: `
<p>Outright fabrication is rarer than it looks. More often, a true photograph is attached to a false event, or a real quotation is trimmed until it means the opposite.</p>
<h2>1. The recycled image</h2>
<p>Reverse image search usually resolves it in minutes. We date the earliest appearance of the image and compare captions across time.</p>
<h2>2. The cropped document</h2>
<p>Page two is where the exception lives. We obtain the full document, including annexures, before quoting page one.</p>
<h2>3. Borrowed authority</h2>
<p>"Doctors say", "scientists confirm", "the Supreme Court ordered" — without a name, a paper, or a case number. Named authority can be checked; anonymous authority usually cannot.</p>
<h2>4. The missing denominator</h2>
<p>A count without a base is unreadable. Twelve cases in a district of two million people and twelve cases in a town of four thousand are different stories.</p>
<h2>5. The quote nobody said</h2>
<p>Screen-grabbed quotes from television are the hardest to verify and the easiest to invent. We ask for the full recording, and if it does not exist we say so.</p>
`,
    language: "en",
    categoryId: "cat-factcheck",
    authorId: "auth-research",
    authorName: "Sample Desk — Research",
    imageUrl: "/images/forward.svg",
    imageCaption: "Five rearrangements account for most viral misinformation.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "explainer",
    underreported: true,
    publishedAt: daysAgo(3),
    updatedAt: daysAgo(3),
    readingMinutes: 6,
    tags: ["misinformation", "fact check"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
  {
    id: "art-bilingual",
    slug: "hindi-and-english-are-not-mirror-translations",
    title: "Hindi and English are not mirror translations of each other here",
    subtitle: "Why a faithful translation sometimes needs a different sentence, not a different word.",
    summary:
      "Our bilingual policy: what we translate, what we never translate, and how readers can tell when a language version is the authoritative one.",
    content: `
<p>Jan Drishti publishes in Hindi and English. The two versions are not decorative copies of one another — they are two renderings of the same evidence, each written for readers who arrive with different context.</p>
<h2>What we translate</h2>
<p>Headlines, standfirsts, body copy and explainer material are written by editors fluent in the language, not passed through a machine and published.</p>
<h2>What we do not translate</h2>
<p>Names, direct quotations, statutory language, court orders and official titles stay in the form in which they were issued. A translated quotation is no longer a quotation.</p>
<h2>Language of record</h2>
<p>Where the versions diverge in meaning, the language of the original reporting is the version of record, and we say so on the page.</p>
`,
    language: "en",
    categoryId: "cat-india",
    authorId: "auth-desk",
    authorName: "Jan Drishti Editorial Desk",
    imageUrl: "/images/press-release.svg",
    imageCaption: "Two languages, one evidence file.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "explainer",
    publishedAt: daysAgo(4),
    updatedAt: daysAgo(4),
    readingMinutes: 4,
    tags: ["bilingual", "policy"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
  {
    id: "art-no-verdict",
    slug: "why-we-will-not-publish-a-verdict-we-cannot-evidence",
    title: "Why we will not publish a verdict we cannot evidence",
    subtitle: "UNVERIFIED is a finding. It is not a placeholder for a conclusion we did not reach.",
    summary:
      "The most important rule in our fact-checking desk: when the record is thin, we say so — with the same rigour we apply to a FALSE verdict.",
    content: `
<p>There is pressure, in every newsroom, to resolve ambiguity. A claim either happened or it did not; readers want a verdict. That pressure is exactly what produces confident errors.</p>
<h2>Three legitimate outcomes</h2>
<p>A claim can be supported by the record, contradicted by it, or simply not resolvable with the evidence available. The third is common, especially for claims about private conversations, unreleased documents and events in places no journalist has reached.</p>
<h2>What we publish when we cannot decide</h2>
<p>We publish the claim, the searches we ran, the sources we found, and an explicit statement of what is missing. A reader should be able to see why the file stops where it stops.</p>
<h2>What we never do</h2>
<p>We never assign a verdict to satisfy a deadline, and we never let an automated system publish one at all. Every published verdict carries a reviewer's name.</p>
`,
    language: "en",
    categoryId: "cat-factcheck",
    authorId: "auth-desk",
    authorName: "Jan Drishti Editorial Desk",
    imageUrl: "/images/corrections.svg",
    imageCaption: "The file stops where the evidence stops.",
    imageCredit: "Illustrative image — Jan Drishti",
    status: "published",
    kind: "opinion",
    publishedAt: daysAgo(5),
    updatedAt: daysAgo(5),
    readingMinutes: 5,
    tags: ["standards", "opinion"],
    sources: [SOURCE_DESK],
    isSample: true,
  },
];

const SAMPLE_CORRECTIONS: Correction[] = [
  {
    id: "corr-1",
    date: daysAgo(6),
    summaryEn: "Sample notice: a figure was corrected after a later official revision.",
    detailEn:
      "This is a demonstration entry. It shows how a correction appears in the log: what changed, when, and why. No real article was affected.",
    issuedBy: "Jan Drishti Editorial Desk",
    severity: "material",
  },
  {
    id: "corr-2",
    date: daysAgo(11),
    summaryEn: "Sample notice: a district name was misspelled in a caption.",
    detailEn: "Demonstration entry for a minor correction. Typographical errors are fixed and logged when they affect identification.",
    issuedBy: "Jan Drishti Editorial Desk",
    severity: "minor",
  },
];

export const SAMPLE_CORRECTIONS_LIST = SAMPLE_CORRECTIONS;

export const SAMPLE_FACT_CHECKS: FactCheck[] = [
  {
    id: "fc-1",
    slug: "sample-illustrative-claim-unverified-example",
    claimId: "claim-1",
    claimText:
      "Illustrative sample claim (not a real viral message): “A new rule makes it compulsory for every student to link a national identity number before school admission this year.”",
    claimLanguage: "en",
    headlineEn: "Sample report: how an unverifiable claim is published as UNVERIFIED",
    verdict: "unverified",
    explanationEn:
      "This is a demonstration report. It shows the shape of an UNVERIFIED finding: the claim is specific enough to check, but the evidence file contains no notification, order or authoritative record that confirms or contradicts it. We therefore do not tell readers it is false — we tell them the record does not settle it, and show exactly what we searched.",
    contextEn:
      "No gazette notification matching the claim was located by the desk in this sample file. The absence of a document is not proof that no rule exists: notices can be issued at state or institution level. Readers should ask the school or department for the written order rather than rely on a forward.",
    supportingEvidence: [],
    contradictingEvidence: [],
    importantContext: [
      {
        id: "ev-1",
        claimId: "claim-1",
        title: "Sample context record — how to ask for the written order",
        url: "/fact-checking-methodology",
        publisher: "Jan Drishti",
        retrievedAt: daysAgo(1),
        sourceType: "primary_record",
        stance: "context",
        quote: "Ask for the notification number and date, then check it against the issuing authority's own website.",
        isPrimary: true,
      },
    ],
    sourceUrls: ["/fact-checking-methodology"],
    claimFirstSeen: null,
    verifiedAt: daysAgo(1),
    publishedAt: daysAgo(1),
    reviewerId: "user-editor",
    reviewerName: "Sample Editor",
    confidenceLevel: "low",
    status: "published",
    correctionVersion: 0,
    tags: ["sample", "education"],
    isSample: true,
    updatedAt: daysAgo(1),
  },
  {
    id: "fc-2",
    slug: "sample-illustrative-claim-false-example",
    claimId: "claim-2",
    claimText:
      "Illustrative sample claim (not a real viral message): “The photograph shows a crowd of two lakh people at an event this week in a district that has a population of forty thousand.”",
    claimLanguage: "en",
    headlineEn: "Sample report: a real photograph attached to an impossible crowd figure",
    verdict: "false",
    explanationEn:
      "This demonstration report shows how a FALSE finding is structured. The arithmetic alone is decisive: a crowd cannot exceed the population of the district it is said to have gathered in. The photograph itself may be genuine and from another event — which is exactly the pattern described in our piece on misleading forwards.",
    contextEn:
      "Viral crowd photographs are routinely recycled across events and years. The verifiable facts here are the district's published population and the absence of any official crowd estimate matching the claim.",
    supportingEvidence: [],
    contradictingEvidence: [
      {
        id: "ev-2",
        claimId: "claim-2",
        title: "Sample contradicting record — published district population",
        url: "/fact-checking-methodology",
        publisher: "Jan Drishti",
        publishedAt: null,
        retrievedAt: daysAgo(2),
        sourceType: "primary_record",
        stance: "contradicts",
        quote: "A crowd figure larger than the resident population of the district cannot be accurate.",
        isPrimary: true,
      },
    ],
    importantContext: [],
    sourceUrls: ["/fact-checking-methodology"],
    claimFirstSeen: daysAgo(4),
    verifiedAt: daysAgo(2),
    publishedAt: daysAgo(2),
    reviewerId: "user-editor",
    reviewerName: "Sample Editor",
    confidenceLevel: "high",
    status: "published",
    correctionVersion: 0,
    isSample: true,
    updatedAt: daysAgo(2),
  },
  {
    id: "fc-3",
    slug: "sample-illustrative-claim-misleading-example",
    claimId: "claim-3",
    claimText:
      "Illustrative sample claim (not a real viral message): “The government has waived all farm loans for every farmer in the country.”",
    claimLanguage: "en",
    headlineEn: "Sample report: a state scheme described as a national waiver",
    verdict: "misleading",
    explanationEn:
      "This demonstration report shows a MISLEADING finding: a genuine scheme exists, but its jurisdiction and eligibility are narrower than the claim. The claim is not invented — it is overstated, which is why the verdict is misleading rather than false.",
    contextEn:
      "Loan waivers in India are typically issued by state governments, with eligibility limited by loan type, size, and the date of disbursal. A state announcement cannot waive loans nationwide, and institutional credit outside the notified categories is unaffected.",
    supportingEvidence: [
      {
        id: "ev-3",
        claimId: "claim-3",
        title: "Sample supporting record — a genuine scheme announcement exists",
        url: "/fact-checking-methodology",
        publisher: "Jan Drishti",
        retrievedAt: daysAgo(3),
        sourceType: "government",
        stance: "supports",
        quote: "State-level waiver schemes are announced periodically, which is what this claim borrows its credibility from.",
      },
    ],
    contradictingEvidence: [
      {
        id: "ev-4",
        claimId: "claim-3",
        title: "Sample contradicting record — jurisdiction limits",
        url: "/editorial-policy",
        publisher: "Jan Drishti",
        retrievedAt: daysAgo(3),
        sourceType: "primary_record",
        stance: "contradicts",
        quote: "A state notification binds only within that state's jurisdiction and notified categories.",
        isPrimary: true,
      },
    ],
    importantContext: [],
    sourceUrls: ["/fact-checking-methodology", "/editorial-policy"],
    claimFirstSeen: daysAgo(5),
    verifiedAt: daysAgo(3),
    publishedAt: daysAgo(3),
    reviewerId: "user-editor",
    reviewerName: "Sample Editor",
    confidenceLevel: "medium",
    status: "published",
    correctionVersion: 0,
    isSample: true,
    updatedAt: daysAgo(3),
  },
];

export const SAMPLE_SUBMISSIONS: Submission[] = [
  {
    id: "sub-1",
    type: "viral_claim",
    content:
      "Sample queue item: a forwarded message claiming a deadline extension for a scholarship scheme, with no link to the official notice.",
    url: null,
    language: "en",
    status: "received",
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(5),
    isSample: true,
    triageNote: "Awaiting researcher triage. Sample data.",
  },
  {
    id: "sub-2",
    type: "viral_claim",
    content:
      "Sample queue item: a screenshot of a television quote submitted without the recording or the date of broadcast.",
    url: null,
    language: "hi",
    status: "researching",
    createdAt: hoursAgo(22),
    updatedAt: hoursAgo(9),
    isSample: true,
    triageNote: "Researcher requested the original broadcast clip. Sample data.",
  },
];

export const SAMPLE_SOURCES: FeedSource[] = [
  {
    id: "feed-pib",
    name: "Press Information Bureau — press releases",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    publisher: "Government of India",
    type: "government",
    enabled: false,
    language: "en",
    lastStatus: "never",
    notes: "Primary government releases. Enable after reviewing robots policy and terms.",
  },
  {
    id: "feed-rbi",
    name: "Reserve Bank of India — press releases",
    url: "https://rbi.org.in/pressreleases_rss.xml",
    publisher: "Reserve Bank of India",
    type: "primary_record",
    enabled: false,
    language: "en",
    lastStatus: "never",
    notes: "Central bank notifications and circulars.",
  },
  {
    id: "feed-licensed",
    name: "Licensed news API (headline + summary only)",
    url: "https://newsapi.org/",
    publisher: "Licensed aggregator",
    type: "independent_journalism",
    enabled: false,
    language: "en",
    lastStatus: "never",
    notes: "Ingest headlines and short summaries only. Never copy full article text.",
  },
];

export const SAMPLE_USERS: EditorialUser[] = [
  { id: "user-admin", email: "admin@example.org", name: "Sample Administrator", role: "admin", createdAt: daysAgo(120), status: "active", lastSeenAt: daysAgo(0) },
  { id: "user-editor", email: "editor@example.org", name: "Sample Editor", role: "editor", createdAt: daysAgo(90), status: "active", lastSeenAt: daysAgo(1) },
  { id: "user-research", email: "research@example.org", name: "Sample Researcher", role: "researcher", createdAt: daysAgo(60), status: "active", lastSeenAt: daysAgo(2) },
  { id: "user-reader", email: "reader@example.org", name: "Sample Reader", role: "user", createdAt: daysAgo(20), status: "active", lastSeenAt: daysAgo(3) },
];

export const SAMPLE_AUDIT: AuditLogEntry[] = [
  {
    id: "audit-1",
    action: "factcheck.published",
    actorId: "user-editor",
    actorEmail: "editor@example.org",
    targetType: "factCheck",
    targetId: "fc-3",
    summary: "Sample log entry: verdict approved and published after evidence review.",
    createdAt: daysAgo(3),
  },
  {
    id: "audit-2",
    action: "article.published",
    actorId: "user-editor",
    actorEmail: "editor@example.org",
    targetType: "article",
    targetId: "art-verification",
    summary: "Sample log entry: article published with sources attached.",
    createdAt: hoursAgo(3),
  },
];

export const SAMPLE_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const AUTHOR_DIRECTORY = [
  { id: "auth-desk", name: "Jan Drishti Editorial Desk", role: "Editorial" },
  { id: "auth-econ", name: "Sample Desk — Economy", role: "Economy desk" },
  { id: "auth-field", name: "Sample Desk — Field Reporting", role: "Reporting" },
  { id: "auth-research", name: "Sample Desk — Research", role: "Research" },
];
