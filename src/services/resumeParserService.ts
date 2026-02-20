export interface StructuredResume {
  summary: string;
  workExperience: string[];
  skills: string[];
  education: string[];
  certifications: string[];
}

type ResumeSectionKey = 'summary' | 'workExperience' | 'skills' | 'education' | 'certifications' | 'other';

const SECTION_PATTERNS: Array<{ key: ResumeSectionKey; pattern: RegExp }> = [
  { key: 'summary', pattern: /^(professional\s+)?(summary|profile|objective|about\s+me)$/i },
  {
    key: 'workExperience',
    pattern: /^(work\s+experience|professional\s+experience|employment\s+history|experience)$/i,
  },
  { key: 'skills', pattern: /^(technical\s+skills|core\s+skills|skills|competencies)$/i },
  { key: 'education', pattern: /^(education|academic\s+background|qualifications)$/i },
  {
    key: 'certifications',
    pattern: /^(certifications?|licenses?|credentials?)$/i,
  },
];

const BULLET_PREFIX = /^[-•*·‣▪◦]\s*/;
const WORK_DATE_RANGE =
  /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+)?\d{4}\s*[-–]\s*(?:present|current|\d{4})\b/i;

const looksLikeWorkHeader = (line: string): boolean => {
  if (WORK_DATE_RANGE.test(line)) {
    return true;
  }

  if (/^[^|]{2,80}\|[^|]{2,80}(?:\|[^|]{2,80})?$/.test(line)) {
    return true;
  }

  return /^[^,]{2,80}\s+(?:at|@)\s+[^,]{2,80}(?:\s*[-–|]\s*.+)?$/i.test(line);
};

const normalizeLines = (rawText: string): string[] =>
  rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

const detectSectionHeading = (line: string): ResumeSectionKey | null => {
  const sanitizedLine = line.replace(/[:|]+$/, '').trim();

  const match = SECTION_PATTERNS.find(({ pattern }) => pattern.test(sanitizedLine));
  return match ? match.key : null;
};

const splitIntoSections = (lines: string[]): Record<ResumeSectionKey, string[]> => {
  const sections: Record<ResumeSectionKey, string[]> = {
    summary: [],
    workExperience: [],
    skills: [],
    education: [],
    certifications: [],
    other: [],
  };

  let currentSection: ResumeSectionKey = 'other';

  for (const line of lines) {
    const section = detectSectionHeading(line);

    if (section) {
      currentSection = section;
      continue;
    }

    sections[currentSection].push(line);
  }

  return sections;
};

const looksLikeContactOrNameLine = (line: string): boolean => {
  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(line)) {
    return true;
  }

  return /@|\+?\d[\d\s().-]{6,}|linkedin\.com|github\.com/i.test(line);
};

const buildSummary = (sections: Record<ResumeSectionKey, string[]>): string => {
  if (sections.summary.length > 0) {
    return sections.summary.join(' ').trim();
  }

  const fallbackLines = sections.other.filter((line) => !looksLikeContactOrNameLine(line));
  return fallbackLines.slice(0, 2).join(' ').trim();
};

const toEntries = (lines: string[]): string[] => {
  const entries: string[] = [];
  let currentEntry: string[] = [];

  for (const line of lines) {
    const cleanLine = line.replace(BULLET_PREFIX, '').trim();

    if (!cleanLine) {
      continue;
    }

    const startsNewEntry = looksLikeWorkHeader(cleanLine);

    if (startsNewEntry && currentEntry.length > 0) {
      entries.push(currentEntry.join(' ').trim());
      currentEntry = [];
    }

    currentEntry.push(cleanLine);
  }

  if (currentEntry.length > 0) {
    entries.push(currentEntry.join(' ').trim());
  }

  return entries;
};

const parseSkills = (lines: string[]): string[] => {
  const tokenizedSkills = lines
    .flatMap((line) => line.replace(BULLET_PREFIX, '').split(/[|,;/]/))
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 1);

  return Array.from(new Set(tokenizedSkills));
};

const parseSimpleSection = (lines: string[]): string[] =>
  lines.map((line) => line.replace(BULLET_PREFIX, '').trim()).filter((line) => line.length > 0);

export const parseResumeText = (rawText: string): StructuredResume => {
  const normalizedLines = normalizeLines(rawText);
  const sections = splitIntoSections(normalizedLines);

  return {
    summary: buildSummary(sections),
    workExperience: toEntries(sections.workExperience),
    skills: parseSkills(sections.skills),
    education: parseSimpleSection(sections.education),
    certifications: parseSimpleSection(sections.certifications),
  };
};
