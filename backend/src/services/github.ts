import { Octokit } from '@octokit/rest';

/**
 * Verify a GitHub Personal Access Token (PAT)
 * Returns the authenticated user's login and avatar url
 */
export async function verifyPat(pat: string): Promise<{ username: string; avatarUrl: string }> {
  const octokit = new Octokit({ auth: pat });
  const { data } = await octokit.users.getAuthenticated();
  return {
    username: data.login,
    avatarUrl: data.avatar_url,
  };
}

/**
 * Fetch all public repositories for a given organization or user fallback
 */
export async function fetchOrgRepos(pat: string, orgName: string) {
  const octokit = new Octokit({ auth: pat });
  try {
    // Try listing for org
    const response = await octokit.repos.listForOrg({
      org: orgName,
      type: 'public',
      per_page: 100,
    });
    return response.data;
  } catch (error: any) {
    // If org not found, try to list public repos for user fallback
    if (error.status === 404) {
      const response = await octokit.repos.listForUser({
        username: orgName,
        type: 'owner',
        per_page: 100,
      });
      return response.data;
    }
    throw error;
  }
}

/**
 * Fetch issues for a repository (excluding pull requests)
 */
export async function fetchRepoIssues(pat: string, owner: string, repoName: string, state: 'open' | 'closed' | 'all' = 'open') {
  const octokit = new Octokit({ auth: pat });
  
  // Fetch issues labeled "bounty"
  let bountyIssues: any[] = [];
  try {
    const responseBounty = await octokit.issues.listForRepo({
      owner,
      repo: repoName,
      state,
      labels: 'bounty',
      per_page: 100,
    });
    bountyIssues = responseBounty.data;
  } catch (err: any) {
    console.warn(`[GitHub Service] Error fetching 'bounty' labeled issues:`, err.message);
  }

  // Fetch issues labeled "reward"
  let rewardIssues: any[] = [];
  try {
    const responseReward = await octokit.issues.listForRepo({
      owner,
      repo: repoName,
      state,
      labels: 'reward',
      per_page: 100,
    });
    rewardIssues = responseReward.data;
  } catch (err: any) {
    console.warn(`[GitHub Service] Error fetching 'reward' labeled issues:`, err.message);
  }

  // Merge and deduplicate by issue ID
  const map = new Map<number, any>();
  for (const issue of bountyIssues) {
    if (!issue.pull_request) {
      map.set(issue.id, issue);
    }
  }
  for (const issue of rewardIssues) {
    if (!issue.pull_request) {
      map.set(issue.id, issue);
    }
  }

  return Array.from(map.values());
}

/**
 * Returns true if a GitHub label is an authentic bounty or reward label.
 * Strips emojis, symbols and punctuation then checks for the bare words.
 * Matches: "Bounty", "💎 Bounty", "bounty: $250", "Reward", "💰 Reward", etc.
 */
export function isBountyLabel(label: string): boolean {
  // Strip everything that isn't a letter or digit, then lower-case
  const bare = label.replace(/[^a-z]/gi, '').toLowerCase();
  return bare === 'bounty' || bare === 'reward';
}

/**
 * Words that provide monetary context in title/body text (used with dollar amounts).
 */
const MONETARY_CONTEXT_KEYWORDS = [
  'bounty',
  'reward',
  'prize',
  'monetize',
  'monetization',
  'monetized',
  'compensation',
  'compensated',
  'paid',
  'payment',
  'payout',
  'paying',
  'remunerat',
  'grant',
  'stipend',
  'sponsor',
  'sponsorship',
  'cash',
  'algora',
  'issuehunt',
  'gitcoin',
  'bugrap',
  'good-first-bounty',
  'help-bounty',
  'paid-issue',
  'paid-contributor',
  'funded',
  'fund',
  'offer',
  'offering',
  'offered',
  'earn',
  'earning',
  'incentive',
  'prize pool',
  'will pay',
  'we pay',
  'get paid',
  'paid for',
  'paid to',
];

const DOLLAR_AMOUNT_PATTERN = /\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/gi;
const SUFFIX_AMOUNT_PATTERN = /\b([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:usd|usdt|dollars?|bucks)\b/gi;
const PREFIX_AMOUNT_PATTERN = /\b(?:bounty|reward|prize|pay(?:ing)?|paid|compensation|grant|stipend|payout|offer(?:ing)?|earn(?:ing)?|up to|worth)\s*(?:of\s*)?\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/gi;
const LABEL_AMOUNT_PATTERN = /(?:\$|usd|usdt|bounty|reward|prize|paid|grant|cash)[\s:/_-]*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*(?:usd|usdt|\$)/i;

function parseAmount(value: string): number | null {
  const amt = parseFloat(value.replace(/,/g, ''));
  return !isNaN(amt) && amt > 0 ? amt : null;
}

function extractAmounts(text: string, patterns: RegExp[]): number[] {
  const amounts: number[] = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[1] || match[2];
      if (raw) {
        const amt = parseAmount(raw);
        if (amt !== null) amounts.push(amt);
      }
    }
  }
  return amounts;
}

function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function hasMonetaryContext(text: string): boolean {
  return containsKeyword(text, MONETARY_CONTEXT_KEYWORDS);
}

/**
 * Parse bounty amounts from issue details.
 * An issue is a bounty if and only if it has a label whose bare text is
 * exactly "bounty" or "reward" (case-insensitive, emojis/symbols stripped).
 */
export function parseBountyAmount(title: string, body: string, labels: string[]): { hasBounty: boolean; amount: number | null } {
  // Check if there is an authentic bounty or reward label
  const bountyLabel = labels.find(isBountyLabel);

  if (!bountyLabel) {
    return { hasBounty: false, amount: null };
  }

  const titleLower = title.toLowerCase();
  const bodyLower = (body || '').toLowerCase();
  const amounts: number[] = [];

  // 1. Try to extract amount from the matched bounty label itself (e.g. "bounty: $100")
  const labelAmountMatch = bountyLabel.match(LABEL_AMOUNT_PATTERN);
  if (labelAmountMatch) {
    const amt = parseAmount(labelAmountMatch[1] || labelAmountMatch[2]);
    if (amt !== null) amounts.push(amt);
  }

  // 2. Look for amounts in other labels (e.g. standalone amount labels like "$100" or "100usd")
  for (const label of labels) {
    if (label.trim() === bountyLabel.trim()) continue;
    const lowerLabel = label.toLowerCase().trim();
    const match = lowerLabel.match(/(?:\$|usd|usdt)[\s:/_-]*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*(?:usd|usdt|\$)/i);
    if (match) {
      const amt = parseAmount(match[1] || match[2]);
      if (amt !== null) amounts.push(amt);
    }
  }

  // 3. Dollar amounts in title are a strong bounty indicator on GitHub
  const titleAmounts = extractAmounts(title, [DOLLAR_AMOUNT_PATTERN, SUFFIX_AMOUNT_PATTERN, PREFIX_AMOUNT_PATTERN]);
  if (titleAmounts.length > 0) {
    amounts.push(...titleAmounts);
  }

  // 4. Dollar amounts in body when paired with monetary context
  if (hasMonetaryContext(bodyLower)) {
    const bodyAmounts = extractAmounts(body || '', [DOLLAR_AMOUNT_PATTERN, SUFFIX_AMOUNT_PATTERN, PREFIX_AMOUNT_PATTERN]);
    if (bodyAmounts.length > 0) {
      amounts.push(...bodyAmounts);
    }
  }

  // 5. Bracketed/prefixed title patterns: "[$500] Fix bug", "$500: Fix bug"
  const titleBracketMatch = title.match(/^\s*[\[\(]?\s*\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*[\]\)]?/i);
  if (titleBracketMatch?.[1]) {
    const amt = parseAmount(titleBracketMatch[1]);
    if (amt !== null) {
      amounts.push(amt);
    }
  }

  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : null;
  return { hasBounty: true, amount: maxAmount };
}

/**
 * Fetch top bounty repos and orgs globally from GitHub
 */
export async function getGlobalTopBountyTargets(pat: string): Promise<{
  topRepositories: { name: string; fullName: string; orgName: string; bountyCount: number }[];
  topOrganizations: { name: string; bountyCount: number }[];
}> {
  const octokit = new Octokit({ auth: pat });
  const q = 'is:issue state:open label:bounty OR label:reward';
  
  try {
    const res = await octokit.search.issuesAndPullRequests({
      q,
      sort: 'updated',
      order: 'desc',
      per_page: 100,
    });
    
    const items = res.data.items || [];
    
    // Group by repository and organization
    const repoCounts = new Map<string, { fullName: string; orgName: string; repoName: string; count: number }>();
    const orgCounts = new Map<string, number>();
    
    for (const item of items) {
      const urlParts = item.html_url.split('/');
      if (urlParts.length >= 5) {
        const orgName = urlParts[3];
        const repoName = urlParts[4];
        const repoFullName = `${orgName}/${repoName}`;
        
        // Count repo
        const repoData = repoCounts.get(repoFullName) || { fullName: repoFullName, orgName, repoName, count: 0 };
        repoData.count++;
        repoCounts.set(repoFullName, repoData);
        
        // Count org
        orgCounts.set(orgName, (orgCounts.get(orgName) || 0) + 1);
      }
    }
    
    // Sort and get top 5
    const topRepositories = Array.from(repoCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(r => ({
        name: r.repoName,
        fullName: r.fullName,
        orgName: r.orgName,
        bountyCount: r.count,
      }));
      
    const topOrganizations = Array.from(orgCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        bountyCount: count,
      }));
      
    return { topRepositories, topOrganizations };
  } catch (err: any) {
    console.error('[GitHub Service] Error fetching global bounty targets:', err.message);
    return { topRepositories: [], topOrganizations: [] };
  }
}


