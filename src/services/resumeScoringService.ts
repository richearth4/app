import { StructuredJobDescription } from './jobDescriptionParserService';
import { StructuredResume } from './resumeParserService';

export interface ResumeMatchScore {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordDensity: number;
  improvementSuggestions: string[];
}

const SKILLS_WEIGHT = 40;
const EXPERIENCE_WEIGHT = 30;
const KEYWORD_WEIGHT = 20;
const SENIORITY_WEIGHT = 10;

const SENIORITY_ORDER = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager'] as const;

const normalizeText = (value: string): string => value.toLowerCase().trim();

const uniqueNormalized = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 0)));

const toKeywordSet = (jobDescription: StructuredJobDescription): string[] =>
  uniqueNormalized([...jobDescription.requiredSkills, ...jobDescription.keyPhrases]);

const calculateSkillsScore = (resume: StructuredResume, jobDescription: StructuredJobDescription): number => {
  if (jobDescription.requiredSkills.length === 0) {
    return SKILLS_WEIGHT;
  }

  const resumeSkills = new Set(uniqueNormalized(resume.skills));
  const requiredSkills = uniqueNormalized(jobDescription.requiredSkills);
  const matches = requiredSkills.filter((skill) => resumeSkills.has(skill)).length;

  return (matches / requiredSkills.length) * SKILLS_WEIGHT;
};

const calculateExperienceRelevance = (resume: StructuredResume, jobDescription: StructuredJobDescription): number => {
  const resumeText = normalizeText([...resume.workExperience, resume.summary].join(' '));

  if (jobDescription.responsibilities.length === 0) {
    return EXPERIENCE_WEIGHT;
  }

  const responsibilityMatches = uniqueNormalized(jobDescription.responsibilities).filter((responsibility) =>
    resumeText.includes(responsibility),
  ).length;

  return (responsibilityMatches / jobDescription.responsibilities.length) * EXPERIENCE_WEIGHT;
};

const calculateKeywordFrequencyScore = (
  resume: StructuredResume,
  jobDescription: StructuredJobDescription,
): { score: number; matchedKeywords: string[]; missingKeywords: string[]; density: number } => {
  const keywords = toKeywordSet(jobDescription);
  const resumeText = normalizeText(
    [
      resume.summary,
      ...resume.workExperience,
      ...resume.skills,
      ...resume.education,
      ...resume.certifications,
    ].join(' '),
  );

  if (keywords.length === 0) {
    return { score: KEYWORD_WEIGHT, matchedKeywords: [], missingKeywords: [], density: 0 };
  }

  const matchedKeywords = keywords.filter((keyword) => resumeText.includes(keyword));
  const missingKeywords = keywords.filter((keyword) => !resumeText.includes(keyword));
  const density = (matchedKeywords.length / keywords.length) * 100;

  return {
    score: (matchedKeywords.length / keywords.length) * KEYWORD_WEIGHT,
    matchedKeywords,
    missingKeywords,
    density: Number(density.toFixed(2)),
  };
};

const findSeniorityIndex = (value: string): number => SENIORITY_ORDER.indexOf(value as (typeof SENIORITY_ORDER)[number]);

const detectResumeSeniority = (resume: StructuredResume): string => {
  const text = normalizeText([resume.summary, ...resume.workExperience].join(' '));

  if (/\b(manager|director|head of|vp|vice president)\b/.test(text)) {
    return 'Manager';
  }

  if (/\b(principal|tech lead|team lead|lead)\b/.test(text)) {
    return 'Lead';
  }

  if (/\b(senior|sr\.?\s)\b/.test(text)) {
    return 'Senior';
  }

  if (/\b(mid|intermediate)\b/.test(text)) {
    return 'Mid';
  }

  if (/\b(junior|jr\.?\s|entry level|associate)\b/.test(text)) {
    return 'Junior';
  }

  if (/\b(intern|internship)\b/.test(text)) {
    return 'Intern';
  }

  return 'Not specified';
};

const calculateSeniorityScore = (resume: StructuredResume, jobDescription: StructuredJobDescription): number => {
  const jobLevel = jobDescription.seniorityLevel;

  if (jobLevel === 'Not specified') {
    return SENIORITY_WEIGHT;
  }

  const resumeLevel = detectResumeSeniority(resume);
  const jobIndex = findSeniorityIndex(jobLevel);
  const resumeIndex = findSeniorityIndex(resumeLevel);

  if (jobIndex === -1 || resumeIndex === -1) {
    return SENIORITY_WEIGHT * 0.5;
  }

  const distance = Math.abs(jobIndex - resumeIndex);

  if (distance === 0) {
    return SENIORITY_WEIGHT;
  }

  if (distance === 1) {
    return SENIORITY_WEIGHT * 0.6;
  }

  return SENIORITY_WEIGHT * 0.2;
};

const buildImprovementSuggestions = (
  missingKeywords: string[],
  skillsScore: number,
  experienceScore: number,
  seniorityScore: number,
): string[] => {
  const suggestions: string[] = [];

  if (missingKeywords.length > 0) {
    suggestions.push(`Add relevant keywords from the job description: ${missingKeywords.slice(0, 8).join(', ')}.`);
  }

  if (skillsScore < SKILLS_WEIGHT * 0.6) {
    suggestions.push('Highlight and expand the required technical skills in your skills section.');
  }

  if (experienceScore < EXPERIENCE_WEIGHT * 0.6) {
    suggestions.push('Align work experience bullet points with the listed responsibilities and outcomes.');
  }

  if (seniorityScore < SENIORITY_WEIGHT * 0.6) {
    suggestions.push('Adjust role titles and achievements to better communicate target seniority alignment.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Your resume aligns well. Consider adding quantified achievements for extra impact.');
  }

  return suggestions;
};

export const scoreResumeAgainstJobDescription = (
  resume: StructuredResume,
  jobDescription: StructuredJobDescription,
): ResumeMatchScore => {
  const skillsScore = calculateSkillsScore(resume, jobDescription);
  const experienceScore = calculateExperienceRelevance(resume, jobDescription);
  const keywordResult = calculateKeywordFrequencyScore(resume, jobDescription);
  const seniorityScore = calculateSeniorityScore(resume, jobDescription);

  const totalScore = Math.min(
    100,
    Math.max(0, Number((skillsScore + experienceScore + keywordResult.score + seniorityScore).toFixed(2))),
  );

  return {
    score: totalScore,
    matchedKeywords: keywordResult.matchedKeywords,
    missingKeywords: keywordResult.missingKeywords,
    keywordDensity: keywordResult.density,
    improvementSuggestions: buildImprovementSuggestions(
      keywordResult.missingKeywords,
      skillsScore,
      experienceScore,
      seniorityScore,
    ),
  };
};
