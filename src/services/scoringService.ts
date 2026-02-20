import { StructuredJobDescription } from './jobDescriptionParserService';
import { StructuredResume } from './resumeParserService';

interface ScoreBreakdown {
  skills: number;
  experienceRelevance: number;
  keywordFrequency: number;
  seniorityAlignment: number;
}

export interface ResumeScoreResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordDensity: number;
  improvementSuggestions: string[];
}

const WEIGHTS: ScoreBreakdown = {
  skills: 40,
  experienceRelevance: 30,
  keywordFrequency: 20,
  seniorityAlignment: 10,
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'the',
  'to',
  'we',
  'with',
  'you',
  'your',
  'will',
  'this',
  'that',
  'their',
  'they',
  'them',
  'who',
  'have',
  'has',
  'must',
  'should',
  'can',
  'able',
  'experience',
  'years',
  'year',
  'team',
  'role',
  'work',
  'using',
]);

const SENIORITY_ORDER = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager'] as const;

const normalizeText = (value: string): string => value.trim().toLowerCase();

const uniqueNormalized = (values: string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
};

const countKeywordOccurrences = (text: string, keyword: string): number => {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z0-9])${escapedKeyword}(?=$|[^a-z0-9])`, 'gi');
  return (text.match(pattern) ?? []).length;
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9+#/.\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const computeSeniorityScore = (resume: StructuredResume, job: StructuredJobDescription): number => {
  const jobLevel = job.seniorityLevel.trim();

  if (!jobLevel || jobLevel === 'Not specified') {
    return WEIGHTS.seniorityAlignment;
  }

  const jobIndex = SENIORITY_ORDER.findIndex((level) => level.toLowerCase() === jobLevel.toLowerCase());

  if (jobIndex === -1) {
    return WEIGHTS.seniorityAlignment;
  }

  const resumeCorpus = [resume.summary, ...resume.workExperience].join(' ').toLowerCase();

  const matchedResumeLevelIndex = SENIORITY_ORDER.findIndex((level) =>
    new RegExp(`\\b${level.toLowerCase()}\\b`, 'i').test(resumeCorpus),
  );

  if (matchedResumeLevelIndex === -1) {
    return WEIGHTS.seniorityAlignment * 0.5;
  }

  const distance = Math.abs(jobIndex - matchedResumeLevelIndex);

  if (distance === 0) {
    return WEIGHTS.seniorityAlignment;
  }

  if (distance === 1) {
    return WEIGHTS.seniorityAlignment * 0.7;
  }

  return WEIGHTS.seniorityAlignment * 0.3;
};

export const scoreResumeAgainstJob = (
  resume: StructuredResume,
  job: StructuredJobDescription,
): ResumeScoreResult => {
  const requiredKeywords = uniqueNormalized([...job.requiredSkills, ...job.keyPhrases]);
  const resumeSkills = uniqueNormalized(resume.skills);
  const resumeExperienceText = [...resume.workExperience, resume.summary].join(' ').toLowerCase();

  const matchedKeywords = requiredKeywords.filter((keyword) => {
    if (resumeSkills.includes(keyword)) {
      return true;
    }

    return resumeExperienceText.includes(keyword);
  });
  const missingKeywords = requiredKeywords.filter((keyword) => !matchedKeywords.includes(keyword));

  const skillsCoverage =
    job.requiredSkills.length === 0
      ? 1
      : job.requiredSkills.filter((skill) =>
          matchedKeywords.includes(normalizeText(skill)) || resumeSkills.includes(normalizeText(skill)),
        ).length / job.requiredSkills.length;
  const skillsScore = skillsCoverage * WEIGHTS.skills;

  const matchedResponsibilities =
    job.responsibilities.length === 0
      ? 1
      : job.responsibilities.filter((responsibility) => {
          const normalizedResponsibility = normalizeText(responsibility);
          return resumeExperienceText.includes(normalizedResponsibility);
        }).length / job.responsibilities.length;
  const experienceRelevanceScore = matchedResponsibilities * WEIGHTS.experienceRelevance;

  const keywordOccurrences = requiredKeywords.reduce(
    (total, keyword) => total + countKeywordOccurrences(resumeExperienceText, keyword),
    0,
  );
  const keywordFrequencyTarget = Math.max(requiredKeywords.length * 2, 1);
  const keywordFrequencyRatio = Math.min(keywordOccurrences / keywordFrequencyTarget, 1);
  const keywordFrequencyScore = keywordFrequencyRatio * WEIGHTS.keywordFrequency;

  const keywordDensity = (() => {
    const tokens = tokenize(resumeExperienceText);

    if (tokens.length === 0 || requiredKeywords.length === 0) {
      return 0;
    }

    const keywordSet = new Set(requiredKeywords.flatMap((keyword) => keyword.split(/\s+/)));
    const keywordTokenCount = tokens.filter((token) => keywordSet.has(token)).length;
    return Number(((keywordTokenCount / tokens.length) * 100).toFixed(2));
  })();

  const seniorityScore = computeSeniorityScore(resume, job);

  const totalScore = Number(
    Math.min(
      Math.max(skillsScore + experienceRelevanceScore + keywordFrequencyScore + seniorityScore, 0),
      100,
    ).toFixed(2),
  );

  const improvementSuggestions: string[] = [];

  if (missingKeywords.length > 0) {
    improvementSuggestions.push(
      `Add evidence of these missing keywords: ${missingKeywords.slice(0, 8).join(', ')}.`,
    );
  }

  if (skillsScore < WEIGHTS.skills * 0.6) {
    improvementSuggestions.push('Increase direct alignment between listed resume skills and required job skills.');
  }

  if (experienceRelevanceScore < WEIGHTS.experienceRelevance * 0.6) {
    improvementSuggestions.push('Rewrite work experience bullets to mirror the job responsibilities more closely.');
  }

  if (keywordFrequencyScore < WEIGHTS.keywordFrequency * 0.5) {
    improvementSuggestions.push('Use important job keywords more frequently in summary and experience sections.');
  }

  if (seniorityScore < WEIGHTS.seniorityAlignment * 0.7) {
    improvementSuggestions.push('Highlight achievements that better match the target seniority level.');
  }

  if (improvementSuggestions.length === 0) {
    improvementSuggestions.push('Strong match overall; fine-tune wording to maximize ATS keyword coverage.');
  }

  return {
    score: totalScore,
    matchedKeywords,
    missingKeywords,
    keywordDensity,
    improvementSuggestions,
  };
};
