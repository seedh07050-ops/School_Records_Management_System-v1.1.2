import { RetentionPeriod, TaskCard } from '../types';

/**
 * 학교 행정업무 표준 핵심어 목록
 * (학교 행정 및 기록물 관리에서 높은 가중치를 갖는 전문 용어)
 */
export const SCHOOL_ADMIN_CORE_KEYWORDS: string[] = [
  // 1. 사용자 명시 학교 행정 핵심어
  '학교운영위원회',
  '예산',
  '결산',
  '회계',
  '지출',
  '계약',
  '물품',
  '급식',
  '식단',
  '시설',
  '공사',
  '안전',
  '소방',
  '전기',
  '인사',
  '복무',
  '임용',
  '발령',
  '호봉',
  '학생',
  '학적',
  '출결',
  '입학',
  '졸업',
  '민원',
  '제증명',
  '정보공개',
  '보안',
  '당직',
  '방재',
  '교육과정',
  '학사',
  '학교행사',

  // 2. 추가 학교 행정 핵심어 (업무 매칭 정확도 향상)
  '교직원',
  '장학',
  '진로',
  '입시',
  '수업',
  '평가',
  '생활기록부',
  '생기부',
  '학교폭력',
  '학폭',
  '방과후',
  '돌봄',
  '체육',
  '보건',
  '영양',
  '위생',
  '정보화',
  '정보통신',
  '도서관',
  '기록물',
  '발전기금',
  '급여',
  '연금',
  '보험',
  '세입',
  '세출',
  '재산',
  '통학',
  '수련활동',
  '수학여행',
  '현장체험',
  '봉사',
  '동아리',
  '상벌',
  '포상',
  '징계',
  '연수',
  '출장',
  '휴가',
  '병가',
  '휴직',
  '복직',
  '재물조사',
  '불용',
  '환경위생',
  '교육공무직',
  '기간제',
  '강사',
  '위원회',
  '심의',
  '회의',
  '회의록',
  '의결',
];

/**
 * 불용어 및 일반 행정 보조어 (낮은 가중치 적용 또는 단독 매칭 제한)
 */
export const STOPWORDS: Set<string> = new Set([
  '관련',
  '관리',
  '운영',
  '계획',
  '자료',
  '문서',
  '철',
  '대장',
  '서류',
  '건',
  '등',
  '사항',
  '추진',
  '실시',
  '결과',
  '보고',
  '안내',
  '제출',
  '접수',
  '대장철',
  '일체',
  '기안',
  '시행',
  '처리',
]);

/**
 * 텍스트 전처리: 연도, 숫자, 괄호, 특수문자 제거 및 공백 정규화
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    // 괄호 및 괄호 안 보조문구 제거: [2026학년도], (초등), <별지> 등
    .replace(/[\[\(\{<【][^\]\)\}>】]*[\]\)\}>】]/g, ' ')
    // 학년도 및 연도 제거: 2026학년도, 2026년, 26년 등
    .replace(/\b(19\d\d|20\d\d)학년도/g, ' ')
    .replace(/\b(19\d\d|20\d\d)년(도)?/g, ' ')
    .replace(/\b\d{1,2}년(도)?/g, ' ')
    // 숫자 제거
    .replace(/\d+/g, ' ')
    // 특수문자 제거 (한글, 영문, 공백 유지)
    .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, ' ')
    // 공백 정리
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 제목과 과제카드명 간에 일치하는 핵심어(Core Keywords) 추출
 */
export function extractMatchedCoreKeywords(
  title: string,
  taskCardName: string
): string[] {
  const normTitleNoSpace = normalizeText(title).replace(/\s+/g, '');
  const normCardNoSpace = normalizeText(taskCardName).replace(/\s+/g, '');

  if (!normTitleNoSpace || !normCardNoSpace) return [];

  const matched: string[] = [];
  // 긴 핵심어 우선 매칭
  const sortedKeywords = [...SCHOOL_ADMIN_CORE_KEYWORDS].sort(
    (a, b) => b.length - a.length
  );

  for (const kw of sortedKeywords) {
    const kwNoSpace = kw.replace(/\s+/g, '');
    if (normTitleNoSpace.includes(kwNoSpace) && normCardNoSpace.includes(kwNoSpace)) {
      // 더 긴 핵심어에 완전히 포함되는 경우 중복 추가 방지
      const alreadySubsumed = matched.some(
        (m) => m.replace(/\s+/g, '').includes(kwNoSpace) && m !== kw
      );
      if (!alreadySubsumed) {
        matched.push(kw);
      }
    }
  }

  // 핵심어 일치가 없을 때 일반 의미 단어 일치 확인 (불용어 제외)
  if (matched.length === 0) {
    const candidateWords = new Set<string>();
    const extractWords = (t: string) =>
      normalizeText(t)
        .split(/\s+/)
        .filter((w) => w.length >= 2);

    const titleWords = extractWords(title);
    const cardWords = extractWords(taskCardName);

    // 카드 단어가 제목에 포함되거나, 제목 단어가 카드에 포함되는 경우
    cardWords.forEach((cw) => {
      if (normTitleNoSpace.includes(cw) && !STOPWORDS.has(cw)) {
        candidateWords.add(cw);
      }
    });
    titleWords.forEach((tw) => {
      if (normCardNoSpace.includes(tw) && !STOPWORDS.has(tw)) {
        candidateWords.add(tw);
      }
    });

    if (candidateWords.size > 0) {
      matched.push(...Array.from(candidateWords));
    }
  }

  // 일반 단어도 없을 때 불용어(운영, 관리, 회의 등) 일치 확인
  if (matched.length === 0) {
    for (const sw of Array.from(STOPWORDS)) {
      if (normTitleNoSpace.includes(sw) && normCardNoSpace.includes(sw)) {
        if (!matched.includes(sw)) {
          matched.push(sw);
        }
      }
    }
  }

  return matched;
}

/**
 * 문자열 Bi-gram 유사도 계산 (Dice Coefficient)
 */
export function calculateBigramSimilarity(strA: string, strB: string): number {
  const sA = strA.replace(/\s+/g, '');
  const sB = strB.replace(/\s+/g, '');
  if (!sA || !sB) return 0;
  if (sA === sB) return 1.0;
  if (sA.length < 2 || sB.length < 2) {
    return sA === sB ? 1.0 : 0;
  }

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < sA.length - 1; i++) {
    const bg = sA.substring(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < sB.length - 1; i++) {
    const bg = sB.substring(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      intersection++;
      bigramsA.set(bg, count - 1);
    }
  }

  const total = (sA.length - 1) + (sB.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0;
}

export interface SimilarityDetail {
  similarity: number; // 0 ~ 100
  matchedKeywords: string[]; // 일치한 핵심어
  matchedTokens: string[];
  exactOrIncluded: boolean;
}

/**
 * 단일 제목과 과제카드명 간의 종합 유사도 계산 (0 ~ 100 점수)
 *
 * 종합 요소:
 * 1. 완전 일치 및 포함 관계 (높은 점수)
 * 2. 학교 행정 핵심어 일치 (높은 가중치)
 * 3. 일반 단어 일치 (중간 가중치)
 * 4. 전체 문자열 Bi-gram 유사도 (보조 점수)
 * 5. 불용어(연도, 운영, 관리 등) 단독 매칭 억제
 */
export function calculateSimilarity(
  title: string,
  taskCardName: string
): SimilarityDetail {
  if (!title || !taskCardName) {
    return {
      similarity: 0,
      matchedKeywords: [],
      matchedTokens: [],
      exactOrIncluded: false,
    };
  }

  const normTitle = normalizeText(title);
  const normCard = normalizeText(taskCardName);

  if (!normTitle || !normCard) {
    return {
      similarity: 0,
      matchedKeywords: [],
      matchedTokens: [],
      exactOrIncluded: false,
    };
  }

  const titleNoSpace = normTitle.replace(/\s+/g, '');
  const cardNoSpace = normCard.replace(/\s+/g, '');

  // 1. 완전 일치 (정규화 후 동일)
  if (titleNoSpace === cardNoSpace) {
    const matched = extractMatchedCoreKeywords(title, taskCardName);
    return {
      similarity: 100,
      matchedKeywords: matched.length > 0 ? matched : [normCard],
      matchedTokens: [normCard],
      exactOrIncluded: true,
    };
  }

  // 2. 일치 핵심어 도출
  const matchedKeywords = extractMatchedCoreKeywords(title, taskCardName);

  // 핵심어가 불용어(운영, 관리 등)인지 여부 확인
  const isOnlyStopwords =
    matchedKeywords.length > 0 &&
    matchedKeywords.every((kw) => STOPWORDS.has(kw));

  const hasCoreDomainKw =
    matchedKeywords.length > 0 && !isOnlyStopwords;

  // 3. 포함 관계 판별
  const isTitleInCard = cardNoSpace.includes(titleNoSpace);
  const isCardInTitle = titleNoSpace.includes(cardNoSpace);
  const exactOrIncluded = isTitleInCard || isCardInTitle;

  // 4. Bi-gram 유사도 계산
  const bigramSim = calculateBigramSimilarity(normTitle, normCard);

  // 5. 점수 산출
  let score = 0;

  if (hasCoreDomainKw) {
    // 핵심 도메인 키워드가 일치하는 경우
    const longestKw = matchedKeywords.reduce((a, b) =>
      a.length >= b.length ? a : b
    );
    const kwLen = longestKw.replace(/\s+/g, '').length;

    // 핵심어가 전체 카드명/제목에서 차지하는 비율 계산
    const cardRatio = kwLen / Math.max(1, cardNoSpace.length);
    const titleRatio = kwLen / Math.max(1, titleNoSpace.length);
    const avgRatio = (cardRatio + titleRatio) / 2;

    if (longestKw === '학교') {
      // '학교'는 대부분의 학교 문서에 공통으로 포함되는 일반 명사이므로 적정 가중치(40% 내외) 부여
      score = 26 + avgRatio * 25 + bigramSim * 20;
    } else if (kwLen >= 6) {
      // e.g. "학교운영위원회" 등 긴 고유 핵심어 일치 시 기본 72점 + 비율 가중치
      score = 72 + avgRatio * 24 + bigramSim * 6;
    } else if (kwLen >= 4) {
      score = 62 + avgRatio * 22 + bigramSim * 8;
    } else {
      score = 52 + avgRatio * 28 + bigramSim * 12;
    }

    // 포함 관계 보너스
    if (exactOrIncluded) {
      score = Math.max(score, 82 + avgRatio * 14);
    }
  } else if (isOnlyStopwords) {
    // 핵심어가 없고 '운영', '관리' 등 불용어만 일치한 경우 (점수 팽창 방지, 사용자 예시: 43%)
    score = 25 + bigramSim * 30;
  } else if (exactOrIncluded) {
    // 일반 텍스트 포함 관계
    const shorterLen = Math.min(titleNoSpace.length, cardNoSpace.length);
    const longerLen = Math.max(titleNoSpace.length, cardNoSpace.length);
    const ratio = shorterLen / longerLen;
    score = 35 + ratio * 35 + bigramSim * 15;
  } else {
    // 일치 단어가 없거나 미미한 경우
    score = bigramSim * 45;
  }

  // 0 ~ 100 사이 정규화
  let finalScore = Math.round(Math.min(100, Math.max(0, score)));

  // 의미 있는 핵심어 및 포함관계가 없는 경우 점수 상한 적용
  if (!hasCoreDomainKw && !exactOrIncluded && !isOnlyStopwords) {
    finalScore = Math.min(finalScore, 25);
  }

  return {
    similarity: finalScore,
    matchedKeywords,
    matchedTokens: matchedKeywords,
    exactOrIncluded,
  };
}

export interface TaskCardRecommendation {
  rank: number;
  id?: string;
  name: string;
  period: RetentionPeriod;
  similarity: number; // 0 ~ 100
  matchedKeywords: string[]; // 일치한 핵심어
  reason: string;
}

export interface RecommendationResult {
  recommended_period: RetentionPeriod;
  similar_task_cards: TaskCardRecommendation[];
  is_none: boolean;
  overall_reason: string;
  matched_card_name?: string;
}

/**
 * 단일 기록물철 제목에 대해 등록된 전체 과제카드와의 유사도를 계산하여
 * 상위 3개 과제카드 및 추천 보존기간 도출
 */
export function recommendTaskCards(
  title: string,
  taskCards: TaskCard[]
): RecommendationResult {
  if (!title || !title.trim() || !taskCards || taskCards.length === 0) {
    return {
      recommended_period: '5년',
      similar_task_cards: [],
      is_none: true,
      overall_reason: '입력된 기록물철 제목이 없거나 등록된 과제카드가 없습니다.',
    };
  }

  // 전체 과제카드 유사도 계산
  const scoredCards: TaskCardRecommendation[] = taskCards.map((card) => {
    const detail = calculateSimilarity(title, card.name);
    const kwText =
      detail.matchedKeywords.length > 0
        ? detail.matchedKeywords.join(', ')
        : '-';

    return {
      rank: 0,
      id: card.id,
      name: card.name,
      period: card.period,
      similarity: detail.similarity,
      matchedKeywords: detail.matchedKeywords,
      reason: kwText,
    };
  });

  // 유사도 내림차순 정렬 (동점 시 카드명 길이 순)
  scoredCards.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return b.name.length - a.name.length;
  });

  // 상위 3개 추출 및 순위 번호 부여
  const top3 = scoredCards.slice(0, 3).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  const top1 = top3[0];

  // 일치하는 과제카드가 없거나 유사도가 10% 이하인 경우 '해당없음' 처리
  const isNone =
    !top1 ||
    top1.similarity <= 10 ||
    top1.matchedKeywords.length === 0;

  if (isNone) {
    return {
      recommended_period: '5년',
      similar_task_cards: [],
      is_none: true,
      overall_reason:
        '등록된 과제카드 중 부합하는 업무가 없어 기본 보존기간인 5년을 추천합니다.',
      matched_card_name: undefined,
    };
  }

  const kwSummary =
    top1.matchedKeywords.length > 0
      ? `(일치 핵심어: ${top1.matchedKeywords.join(', ')})`
      : '';

  return {
    recommended_period: top1.period,
    similar_task_cards: top3,
    is_none: false,
    overall_reason: `과제카드 '${top1.name}'${kwSummary} 기준에 따라 보존기간 ${top1.period}을 추천합니다.`,
    matched_card_name: top1.name,
  };
}

export interface BatchRecommendItem {
  id: string;
  title: string;
}

export interface BatchRecommendItemResult {
  period: RetentionPeriod;
  reason: string;
  topMatch?: TaskCardRecommendation;
  isNone: boolean;
}

/**
 * 다수 기록물철에 대해 로컬 알고리즘으로 일괄 추천 계산
 * (외부 API 호출 없이 100% 로컬에서 수백~수천 건도 수십 밀리초 내 고속 처리)
 */
export function batchRecommend(
  items: BatchRecommendItem[],
  taskCards: TaskCard[]
): Map<string, BatchRecommendItemResult> {
  const resultMap = new Map<string, BatchRecommendItemResult>();

  if (!items || items.length === 0 || !taskCards || taskCards.length === 0) {
    return resultMap;
  }

  items.forEach((item) => {
    const res = recommendTaskCards(item.title, taskCards);
    const topMatch = res.similar_task_cards[0];

    resultMap.set(item.id, {
      period: res.recommended_period,
      reason: res.overall_reason,
      topMatch,
      isNone: res.is_none,
    });
  });

  return resultMap;
}
