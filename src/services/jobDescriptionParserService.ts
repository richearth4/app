export interface StructuredJobDescription {
  requiredSkills: string[];
  responsibilities: string[];
  seniorityLevel: string;
  keyPhrases: string[];
}

const BULLET_PREFIX = /^[-•*·‣▪◦]\s*/;

const SKILL_ALIASES: Record<string, string[]> = {
  JavaScript: ['javascript', 'js'],
  TypeScript: ['typescript', 'ts'],
  'Node.js': ['node.js', 'nodejs', 'node'],
  React: ['react', 'reactjs', 'react.js'],
  Angular: ['angular'],
  Vue: ['vue', 'vue.js'],
  Python: ['python'],
  Java: ['java'],
  'C#': ['c#', 'dotnet', '.net'],
  SQL: ['sql', 'postgresql', 'mysql', 'sqlite'],
  AWS: ['aws', 'amazon web services'],
  Azure: ['azure'],
  GCP: ['gcp', 'google cloud', 'google cloud platform'],
  Docker: ['docker', 'containerization', 'containers'],
  Kubernetes: ['kubernetes', 'k8s'],
  'CI/CD': ['ci/cd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  Git: ['git', 'github', 'gitlab', 'bitbucket'],
  'REST APIs': ['rest', 'restful', 'api design', 'apis'],
  GraphQL: ['graphql'],
  Agile: ['agile', 'scrum', 'kanban'],
  Communication: ['communication', 'stakeholder management', 'collaboration'],
  Leadership: ['leadership', 'mentoring', 'coaching'],
};

const RESPONSIBILITY_HINTS = [
  'design',
  'develop',
  'build',
  'implement',
  'maintain',
  'deliver',
  'collaborate',
  'lead',
  'own',
  'support',
  'optimize',
  'manage',
  'analyze',
  'drive',
  'create',
];

const SENIORITY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Intern', pattern: /\b(intern|internship)\b/i },
  { label: 'Junior', pattern: /\b(junior|entry\s*level|associate)\b/i },
  { label: 'Mid', pattern: /\b(mid|mid\s*level|intermediate)\b/i },
  { label: 'Senior', pattern: /\b(senior|sr\.?|lead\s+engineer)\b/i },
  { label: 'Lead', pattern: /\b(tech\s+lead|lead\b|principal)\b/i },
  { label: 'Manager', pattern: /\b(manager|head\s+of|director|vp|vice\s+president)\b/i },
];

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

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const normalizeLines = (rawText: string): string[] =>
  rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0);

const normalizeSentence = (line: string): string =>
  line.replace(BULLET_PREFIX, '').replace(/^[0-9]+[.)]\s*/, '').trim();

const splitSentences = (rawText: string): string[] =>
  rawText
    .replace(/\r?\n/g, '. ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeSentence(sentence))
    .filter((sentence) => sentence.length > 0);

const countTokens = (rawText: string): Map<string, number> => {
  const counts = new Map<string, number>();

  const tokens = rawText
    .toLowerCase()
    .replace(/[^a-z0-9+#/.\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
};

const extractRequiredSkills = (rawText: string, tokenCounts: Map<string, number>): string[] => {
  const loweredText = rawText.toLowerCase();
  const scoredSkills = Object.entries(SKILL_ALIASES)
    .map(([skill, aliases]) => {
      const score = aliases.reduce((total, alias) => {
        const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const aliasPattern = new RegExp(`\\b${escapedAlias}\\b`, 'gi');
        const aliasHits = (loweredText.match(aliasPattern) ?? []).length;
        const fallbackTokenScore = tokenCounts.get(alias.toLowerCase()) ?? 0;
        return total + aliasHits + fallbackTokenScore;
      }, 0);

      return { skill, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));

  return scoredSkills.slice(0, 12).map(({ skill }) => skill);
};

const extractResponsibilities = (lines: string[]): string[] => {
  const responsibilities = lines
    .map((line) => normalizeSentence(line))
    .filter((line) => line.length > 20)
    .filter((line) => {
      const loweredLine = line.toLowerCase();
      return RESPONSIBILITY_HINTS.some((hint) => loweredLine.includes(hint));
    });

  return Array.from(new Set(responsibilities)).slice(0, 10);
};

const detectSeniorityLevel = (rawText: string): string => {
  const text = rawText.toLowerCase();
  const matched = SENIORITY_PATTERNS.find(({ pattern }) => pattern.test(text));
  return matched ? matched.label : 'Not specified';
};

const extractKeyPhrases = (rawText: string): string[] => {
  const sentenceTokens = splitSentences(rawText).map((sentence) =>
    sentence
      .toLowerCase()
      .replace(/[^a-z0-9+#/.\s-]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );

  const phraseCounts = new Map<string, number>();

  for (const tokens of sentenceTokens) {
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const bigram = `${tokens[index]} ${tokens[index + 1]}`;
      phraseCounts.set(bigram, (phraseCounts.get(bigram) ?? 0) + 1);

      if (index < tokens.length - 2) {
        const trigram = `${bigram} ${tokens[index + 2]}`;
        phraseCounts.set(trigram, (phraseCounts.get(trigram) ?? 0) + 1);
      }
    }
  }

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 12)
    .map(([phrase]) => phrase);
};

export const parseJobDescriptionText = (rawText: string): StructuredJobDescription => {
  const normalizedText = normalizeWhitespace(rawText);
  const lines = normalizeLines(rawText);
  const tokenCounts = countTokens(normalizedText);

  return {
    requiredSkills: extractRequiredSkills(normalizedText, tokenCounts),
    responsibilities: extractResponsibilities(lines),
    seniorityLevel: detectSeniorityLevel(normalizedText),
    keyPhrases: extractKeyPhrases(normalizedText),
  };
};
