import { RecordItem, RetentionPeriod, BoxGroup } from '../types';

/**
 * 만료연도 계산
 * 종료년도 + 보존기간 = 만료연도
 * 영구 및 준영구 기록물은 만료연도를 '-'로 표시한다.
 */
export function calculateExpiryYear(endYear: number, period: RetentionPeriod): string {
  if (period === '영구' || period === '준영구') {
    return '-';
  }
  const numericPeriod = parseInt(period.replace(/[^0-9]/g, ''), 10);
  if (isNaN(numericPeriod)) {
    return '-';
  }
  return String(endYear + numericPeriod);
}

/**
 * 만료일 계산
 * 만료일은 해당 만료연도의 12월 31일로 취급한다.
 */
export function calculateExpiryDate(endYear: number, period: RetentionPeriod): string {
  const expiryYear = calculateExpiryYear(endYear, period);
  if (expiryYear === '-') {
    return '-';
  }
  return `${expiryYear}-12-31`;
}

/**
 * 고유 record_id 생성기 (내부 불변 식별자)
 * 시스템 내부적으로 절대 중복되지 않는 고유 키
 */
export function generateRecordId(existingIds: string[]): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const id of existingIds) {
    const match = id.match(/REC-(\d+)-(\d+)/);
    if (match) {
      const seq = parseInt(match[2], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `REC-${year}-${nextSeq}`;
}

/**
 * 요구사항 6, 7, 8:
 * 화면 표시용 「기록물 고유번호」 생성기
 * 형식: [보존기간]-[6자리 숫자] (예: 5년-000064, 10년-000001, 영구-000001)
 * 보존기간별로 일련번호를 독립적으로 관리하며 부족한 자리는 앞에 0을 채움.
 */
export function generateRecordNo(
  period: RetentionPeriod,
  existingRecords: RecordItem[]
): string {
  const prefix = `${period}-`;
  let maxSeq = 0;

  for (const rec of existingRecords) {
    if (rec.record_no && rec.record_no.startsWith(prefix)) {
      const numPart = rec.record_no.substring(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(6, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * 요구사항 9:
 * 보존기간 변경 시 화면 표시용 기록물 고유번호 업데이트
 * 예: 10년-000064 -> 5년-000064 (충돌 시 다음 가용 번호 할당)
 * 내부 record_id는 절대 변경하지 않음.
 */
export function updateRecordNoOnPeriodChange(
  currentRecordNo: string | undefined,
  newPeriod: RetentionPeriod,
  existingRecords: RecordItem[],
  currentRecordId: string
): string {
  const targetPrefix = `${newPeriod}-`;

  // 기존 번호에서 숫자 부분 추출 시도
  let seqStr = '';
  if (currentRecordNo) {
    const match = currentRecordNo.match(/-(\d{6})$/);
    if (match) {
      seqStr = match[1];
    }
  }

  if (seqStr) {
    const candidate = `${targetPrefix}${seqStr}`;
    // 다른 기록물(현재 레코드 제외)과 충돌하는지 확인
    const isConflict = existingRecords.some(
      (r) => r.record_id !== currentRecordId && r.record_no === candidate
    );
    if (!isConflict) {
      return candidate;
    }
  }

  // 충돌하거나 기존 번호가 없으면 해당 보존기간의 새 번호 생성
  return generateRecordNo(
    newPeriod,
    existingRecords.filter((r) => r.record_id !== currentRecordId)
  );
}

/**
 * 요구사항 8, 9, 10:
 * 상자번호 규칙: [보존기간]-[종료년도]-[상자번호]
 * 예: 5년-2026-1, 10년-2026-1, 10년-2025-3
 * 보존기간 + 종료년도 조합을 기준으로 관리하며, 기존에 해당 조합의 상자가 있으면 maxSeq + 1 추천
 */
export function recommendBoxNo(
  period: RetentionPeriod,
  endYear: number | undefined,
  existingRecords: RecordItem[]
): string {
  const resolvedEndYear = endYear || new Date().getFullYear();
  const prefix = `${period}-${resolvedEndYear}-`;

  const existingSeqs: number[] = [];

  for (const r of existingRecords) {
    const box = (r.box_no || '').trim();
    if (box.startsWith(prefix)) {
      const numPart = parseInt(box.substring(prefix.length), 10);
      if (!isNaN(numPart) && numPart > 0) {
        existingSeqs.push(numPart);
      }
    }
  }

  if (existingSeqs.length === 0) {
    return `${prefix}1`;
  }

  const maxSeq = Math.max(...existingSeqs);
  return `${prefix}${maxSeq + 1}`;
}

/**
 * 특정 보존기간 및 종료년도(또는 전체)에 등록된 기존 상자번호 목록 반환
 * 사용자가 기존 상자에 기록물을 합치고자 할 때 선택 지원
 */
export function getExistingBoxNumbers(
  period: RetentionPeriod | undefined,
  endYear: number | undefined,
  existingRecords: RecordItem[]
): string[] {
  const set = new Set<string>();
  const prefix = period && endYear ? `${period}-${endYear}-` : '';

  for (const r of existingRecords) {
    const box = (r.box_no || '').trim();
    if (box) {
      if (!prefix || box.startsWith(prefix)) {
        set.add(box);
      }
    }
  }
  return Array.from(set).sort();
}

/**
 * 상자번호별 자동 그룹화
 * 하나의 상자에 포함된 모든 활성 기록물을 취합하여 라벨 정보 구성
 */
export function groupRecordsByBox(records: RecordItem[]): BoxGroup[] {
  // 활성 정식 관리 기록물 중 상자번호가 유효하게 입력된 것만 대상 (상자번호가 공백/빈 값인 기록물은 라벨출력에서 제외)
  const activeRecords = records.filter(
    (r) => r.is_completed && !r.is_disposed && !r.is_transferred && Boolean(r.box_no && r.box_no.trim() !== '')
  );

  const boxMap = new Map<string, RecordItem[]>();

  for (const record of activeRecords) {
    const boxNo = record.box_no.trim();
    if (!boxMap.has(boxNo)) {
      boxMap.set(boxNo, []);
    }
    boxMap.get(boxNo)!.push(record);
  }

  const groups: BoxGroup[] = [];

  boxMap.forEach((boxRecords, box_no) => {
    // 대표 서가번호 (가장 많은 빈도 또는 첫번째)
    const shelfNos = Array.from(new Set(boxRecords.map((r) => r.shelf_no).filter(Boolean)));
    const shelf_no = shelfNos.join(', ') || '-';

    // 고유 보존기간들
    const retention_periods = Array.from(new Set(boxRecords.map((r) => r.retention_period)));

    // 생산년도 범위: 기록물의 종료년도가 모두 동일하면 단일연도(예: 2026년), 다른 것들이 모여있으면 범위로 표시(예: 2021년~2026년)
    const endYears = boxRecords
      .map((r) => r.end_year)
      .filter((y) => typeof y === 'number' && !isNaN(y) && y > 0);
    let year_range = '-';
    if (endYears.length > 0) {
      const minEndYear = Math.min(...endYears);
      const maxEndYear = Math.max(...endYears);
      year_range = minEndYear === maxEndYear ? `${minEndYear}년` : `${minEndYear}년~${maxEndYear}년`;
    }

    groups.push({
      box_no,
      shelf_no,
      records: boxRecords,
      record_count: boxRecords.length,
      retention_periods,
      year_range,
    });
  });

  // 상자번호 오름차순 정렬 (자연 정렬)
  return groups.sort((a, b) =>
    a.box_no.localeCompare(b.box_no, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
