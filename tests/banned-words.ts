/**
 * Words no user-facing text of the free model may use: preset names, "Why?" text, overrides,
 * hold reasons (tests/presets.test.ts) and variable-card text (tests/free-cards.test.ts). Gore
 * and death words follow tests/pages.test.ts; betting words follow design §4.5; titles,
 * trademarks, platforms and view counts follow the common-noun rule of design §1.2.
 */
export const BANNED: readonly RegExp[] = [
  /(?<![가-힣])피[를가]|유혈|학살|도륙|잔혹|\b(?:blood\w*|bloody|massacre\w*|gore|gory|slaughter\w*|corpses?|wounds?)\b|kill count/i,
  /(?<!가)죽[은을는지기음었이]|사망|\b(?:dead|deadliest|killed|kills?|died|dies|die|death)\b|to the death/i,
  /베팅|배팅|배당|도박|내기|\b(?:odds|bets?|betting|wager\w*|stakes?|prizes?|jackpot|gambl\w*)\b/i,
  /월드컵|world ?cup|쥬라기|jurassic (?:park|world)|고질라|godzilla|킹콩|king ?kong|포켓몬|pok[eé]mon|디지몬|digimon|공룡왕|dinosaur king/i,
  /페이스 ?오프|face-?off|who would win|누가 이길까|아이스 ?에이지|walking with dinosaurs|prehistoric planet/i,
  /내셔널 ?지오그래픽|national geographic|애니멀 ?플래닛|animal planet|디스커버리|discovery channel|\bbbc\b|핑크퐁|pinkfong|아기 ?상어|baby shark/i,
  /몬스터 ?헌터|monster hunter|battle simulator|룰렛|roulette/i,
  /치지직|chzzk|트위치|twitch|유튜브|youtube|아프리카 ?tv|afreeca|\bsoop\b/i,
  /조회|\bviews?\b/i,
  /[《》『』「」〈〉"“”]/,
];

export const bannedIn = (s: string): string | null => {
  for (const re of BANNED) {
    const m = re.exec(s);
    if (m) return m[0];
  }
  return null;
};
