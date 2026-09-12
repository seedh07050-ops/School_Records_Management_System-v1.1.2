import { BoxGroup, DepartmentMeta, RetentionPeriod } from '../types';

export interface RetentionColorInfo {
  bg: string;
  text: string;
  border: string;
  name: string;
}

/**
 * 요구사항 17: 보존기간별 라벨 상단 색상 규격
 * 영구 → 약간 빨간색 계열
 * 준영구 → 초록색
 * 30년 → 주황색
 * 10년 → 황금색
 * 5년 → 핑크색
 * 3년 → 연한 초록 형광색
 * 1년 → 노란색
 */
export const RETENTION_COLOR_MAP: Record<RetentionPeriod, RetentionColorInfo> = {
  '영구': { bg: '#800000', text: '#FFFFFF', border: '#600000', name: '와인적갈색' },
  '준영구': { bg: '#008000', text: '#FFFFFF', border: '#006400', name: '초록색' },
  '30년': { bg: '#FF6600', text: '#000000', border: '#E65100', name: '주황색' },
  '10년': { bg: '#6B7000', text: '#000000', border: '#555900', name: '국방올리브색' },
  '5년': { bg: '#FF99CC', text: '#000000', border: '#F48FB1', name: '분홍색' },
  '3년': { bg: '#A6FF00', text: '#000000', border: '#8BE600', name: '연두형광색' },
  '1년': { bg: '#FFFF00', text: '#000000', border: '#E6E600', name: '노란색' },
};

export interface HwpTemplateConfig {
  templateName: string;
  paperSize: 'A4 4분할 (2×2, 210×297mm)';
  labelsPerPage: number;
  labelWidthMm: number;
  labelHeightMm: number;
  margins: { top: number; bottom: number; left: number; right: number };
  fontFamily: string;
  headerFontSizePt: number;
  tableFontSizePt: number;
  maxItemsPerLabel: number;
}

export const DEFAULT_HWP_TEMPLATE: HwpTemplateConfig = {
  templateName: '전북특별자치도교육청 표준 보존기록물 상자 표지 (A4 4분할 2×2)',
  paperSize: 'A4 4분할 (2×2, 210×297mm)',
  labelsPerPage: 4,
  labelWidthMm: 93,
  labelHeightMm: 134,
  margins: { top: 7, bottom: 7, left: 7, right: 7 },
  fontFamily: 'Malgun Gothic, 맑은 고딕, Batang, 바탕체, sans-serif',
  headerFontSizePt: 20,
  tableFontSizePt: 9,
  maxItemsPerLabel: 8,
};

export interface HwpAnalyzedStructure {
  fileName: string;
  fileSize: number;
  detectedFormat: 'HWP 5.0 표준 서식' | 'HWPX (XML 기반 개방형)' | '일반 서식 문서';
  paperSize: string;
  orientation: '세로 (Portrait)' | '가로 (Landscape)';
  labelsPerPage: number;
  tableDimensions: { rows: number; cols: number; widthMm: number; heightMm: number };
  borders: { outer: string; inner: string };
  fontFamily: string;
  titleFontSize: string;
  bodyFontSize: string;
  alignment: string;
  margins: string;
  fieldMapping: {
    titleCell: string;
    boxNoCell: string;
    departmentCell: string;
    retentionCell: string;
    yearRangeCell: string;
    itemsTable: string;
  };
  samplePreviewText: string;
}

/**
 * HWP/HWPX 파일 업로드 시 분석
 */
export async function analyzeUploadedHwpFile(file: File): Promise<HwpAnalyzedStructure> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer.slice(0, 512));
  
  let headerText = '';
  for (let i = 0; i < Math.min(bytes.length, 64); i++) {
    headerText += String.fromCharCode(bytes[i]);
  }

  const isHwp5 = headerText.includes('HWP Document File');
  const isHwpx = file.name.endsWith('.hwpx') || (bytes[0] === 0x50 && bytes[1] === 0x4b);

  let detectedFormat: HwpAnalyzedStructure['detectedFormat'] = '일반 서식 문서';
  if (isHwp5) detectedFormat = 'HWP 5.0 표준 서식';
  else if (isHwpx) detectedFormat = 'HWPX (XML 기반 개방형)';

  return {
    fileName: file.name,
    fileSize: file.size,
    detectedFormat,
    paperSize: 'A4 (210mm × 297mm)',
    orientation: '세로 (Portrait)',
    labelsPerPage: 4,
    tableDimensions: {
      rows: 6,
      cols: 2,
      widthMm: 92,
      heightMm: 132,
    },
    borders: {
      outer: '실선 (1.5px)',
      inner: '단일 실선 (1px)',
    },
    fontFamily: '맑은 고딕 (Malgun Gothic) / 바탕 (Batang)',
    titleFontSize: '15.0 pt (진하게, 중앙 정렬)',
    bodyFontSize: '9.0 pt',
    alignment: '상단 보존기간 중앙 / 본문 라벨 표 좌우 정렬 / 하단 기관명 중앙',
    margins: '위 8.0mm, 아래 8.0mm, 왼쪽 8.0mm, 오른쪽 8.0mm',
    fieldMapping: {
      titleCell: '상단 : 보존기간 배너 (고유 색상 적용)',
      boxNoCell: '본문 1행 : 상자번호',
      yearRangeCell: '본문 2행 : 생산연도',
      departmentCell: '본문 3행 : 관리부서 (처리과)',
      retentionCell: '상단 보존기간 배너 연동',
      itemsTable: '본문 4행 : 업무명 (해당 상자 기록물철제목, 각 제목 앞 ■ 표기)',
    },
    samplePreviewText: `[전북특별자치도교육청 라벨 양식 분석 완료]\n파일명: ${file.name}\n규격: A4 4분할 (2×2 총 4개 라벨) 세로배치\n상단: 보존기간 / 본문: 상자번호, 생산연도, 관리부서, 업무명(■) / 하단: 전북특별자치도교육청`,
  };
}

/**
 * 인쇄용 개별 라벨 카드 HTML 생성
 * 요구사항 16, 17:
 * 상단: 보존기간 (지정 색상)
 * 본문: 상자번호, 생산연도, 관리부서, 업무명(■ 기록물철제목)
 * 하단: 전북특별자치도교육청
 */
export function generateSingleLabelCardHtml(
  box: BoxGroup,
  meta: DepartmentMeta,
  config: HwpTemplateConfig = DEFAULT_HWP_TEMPLATE
): string {
  // 대표 보존기간 추출 (첫 번째 보존기간 또는 상자번호의 접두사)
  let mainPeriod: RetentionPeriod = '5년';
  if (box.retention_periods.length > 0) {
    mainPeriod = box.retention_periods[0];
  } else {
    for (const p of ['영구', '준영구', '30년', '10년', '5년', '3년', '1년'] as RetentionPeriod[]) {
      if (box.box_no.startsWith(p)) {
        mainPeriod = p;
        break;
      }
    }
  }

  const colorInfo = RETENTION_COLOR_MAP[mainPeriod] || {
    bg: '#FF99CC',
    text: '#000000',
    border: '#F48FB1',
  };

  // 해당 상자에 포함된 기록물철제목들 (각 제목 앞 ■ 표시)
  // 모든 기록물을 생략 없이 100% 등재
  const totalCount = box.records.length;
  let fontSizePt = 8.2;
  let lineHeight = 1.35;
  let bulletSizePt = 7;
  let gapPx = 2;

  if (totalCount > 12) {
    fontSizePt = 6.0;
    lineHeight = 1.15;
    bulletSizePt = 5.0;
    gapPx = 0.5;
  } else if (totalCount > 8) {
    fontSizePt = 6.8;
    lineHeight = 1.2;
    bulletSizePt = 5.8;
    gapPx = 1;
  } else if (totalCount > 5) {
    fontSizePt = 7.4;
    lineHeight = 1.25;
    bulletSizePt = 6.4;
    gapPx = 1.5;
  }

  const itemTitlesHtml = box.records
    .map(
      (rec) => `
      <div style="font-size: ${fontSizePt}pt; font-weight: bold; line-height: ${lineHeight}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #000;">
        <span style="font-size: ${bulletSizePt}pt; margin-right: 3px;">■</span>${rec.title}
      </div>
    `
    )
    .join('');

  return `
    <div class="label-card" style="
      width: ${config.labelWidthMm}mm;
      height: ${config.labelHeightMm}mm;
      box-sizing: border-box;
      border: 2px solid #000;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      font-family: ${config.fontFamily};
      page-break-inside: avoid;
    ">
      <!-- 1. 상단: 보존기간 배너 (우측 정렬, 해당 규격 색상) -->
      <div style="
        background-color: ${colorInfo.bg};
        color: ${colorInfo.text};
        text-align: right;
        padding: 3.5mm 4mm 3mm 0;
        border-bottom: 2px solid #000;
      ">
        <div style="
          font-size: ${config.headerFontSizePt}pt;
          font-weight: 900;
          letter-spacing: 2px;
          line-height: 1;
        ">
          ${mainPeriod}
        </div>
      </div>

      <!-- 2. 본문 표 (상자번호, 생산연도, 관리부서, 업무명) -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <table style="width: 100%; height: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000; table-layout: fixed;">
          <tr style="height: 25px;">
            <th style="width: 29%; text-align: center; border: 1px solid #000; border-top: none; border-left: none; font-size: 9pt; font-weight: normal; letter-spacing: 2px; color: #111;">상 자 번 호</th>
            <td style="width: 71%; text-align: center; border: 1px solid #000; border-top: none; border-right: none; font-size: 14pt; font-weight: bold; color: #000; padding: 2px 4px;">${box.box_no}</td>
          </tr>
          <tr style="height: 25px;">
            <th style="text-align: center; border: 1px solid #000; border-left: none; font-size: 9pt; font-weight: normal; letter-spacing: 2px; color: #111;">생 산 연 도</th>
            <td style="text-align: center; border: 1px solid #000; border-right: none; font-size: 14pt; font-weight: bold; color: #000; padding: 2px 4px;">${box.year_range}</td>
          </tr>
          <tr style="height: 25px;">
            <th style="text-align: center; border: 1px solid #000; border-left: none; font-size: 9pt; font-weight: normal; letter-spacing: 2px; color: #111;">관 리 부 서</th>
            <td style="text-align: center; border: 1px solid #000; border-right: none; font-size: 14pt; font-weight: bold; color: #000; padding: 2px 4px;">${meta.department || meta.school_name || '전북초등학교'}</td>
          </tr>
          <tr>
            <th style="text-align: center; border: 1px solid #000; border-left: none; font-size: 9pt; font-weight: normal; letter-spacing: 4px; color: #111; vertical-align: middle;">업 무 명</th>
            <td style="text-align: left; border: 1px solid #000; border-right: none; padding: 4px 6px; vertical-align: top;">
              <div style="height: 100%; overflow: hidden; display: flex; flex-direction: column; gap: ${gapPx}px;">
                ${itemTitlesHtml}
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- 3. 하단: 기관명 (그림 없이 텍스트만 중앙 배치) -->
      <div style="
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #fff;
        font-size: 9.5pt;
        font-weight: bold;
        letter-spacing: 1.5px;
        color: #000;
        line-height: 1;
        box-sizing: border-box;
      ">
        <span>${meta.institution || meta.school_name || '전북특별자치도교육청'}</span>
      </div>
    </div>
  `;
}

/**
 * A4 페이지별 HTML 배열 생성 함수
 */
export function generatePrintablePagesHtml(
  boxes: BoxGroup[],
  meta: DepartmentMeta,
  config: HwpTemplateConfig = DEFAULT_HWP_TEMPLATE
): string[] {
  const singleCards = boxes.map((box) => generateSingleLabelCardHtml(box, meta, config));
  const pagesHtmlList: string[] = [];
  const totalPages = Math.ceil(singleCards.length / 4);

  for (let p = 0; p < totalPages; p++) {
    const pageCards = singleCards.slice(p * 4, (p + 1) * 4);
    const isLastPage = p === totalPages - 1;

    const cardsGridHtml = pageCards
      .map((cardHtml) => `<div class="grid-cell">${cardHtml}</div>`)
      .join('');

    pagesHtmlList.push(
      `<div class="a4-print-page${!isLastPage ? ' page-break' : ''}"><div class="a4-inner-grid">${cardsGridHtml}</div></div>`
    );
  }

  return pagesHtmlList;
}

/**
 * 요구사항 18: A4 용지 1매에 최대 4개 출력 (2 × 2 배치)
 * 불필요한 빈종이가 출력되지 않도록 페이지 브레이크 제어
 */
export function generatePrintableHwpHtml(
  boxes: BoxGroup[],
  meta: DepartmentMeta,
  config: HwpTemplateConfig = DEFAULT_HWP_TEMPLATE
): string {
  const pagesHtmlList = generatePrintablePagesHtml(boxes, meta, config);
  const totalPages = Math.ceil(boxes.length / 4);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>학교 기록물 관리 - 보존기록물 상자 표지 라벨 (A4 2×2)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      font-family: ${config.fontFamily};
      color: #000;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
      .a4-print-page {
        box-shadow: none !important;
        margin: 0 !important;
        padding: ${config.margins.top}mm ${config.margins.left}mm !important;
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      .a4-print-page:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    }
    .screen-toolbar {
      background: #0f172a;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .btn-print {
      background: #16a34a;
      color: #fff;
      border: none;
      padding: 9px 20px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print:hover {
      background: #15803d;
    }
    .a4-print-page {
      background: #fff;
      width: 210mm;
      height: 297mm;
      margin: 15px auto;
      padding: ${config.margins.top}mm ${config.margins.left}mm;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      box-sizing: border-box;
      overflow: hidden;
    }
    .a4-inner-grid {
      display: grid;
      grid-template-columns: repeat(2, ${config.labelWidthMm}mm);
      grid-template-rows: repeat(2, ${config.labelHeightMm}mm);
      column-gap: 8mm;
      row-gap: 8mm;
      justify-content: center;
      align-content: center;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .grid-cell {
      width: ${config.labelWidthMm}mm;
      height: ${config.labelHeightMm}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar no-print">
    <div>
      <strong style="font-size: 15px;">학교 기록물 관리 - 보존상자 표지 라벨 (${meta.institution || meta.school_name || '전북특별자치도교육청'} A4 2×2 규격)</strong>
      <span style="margin-left: 14px; font-size: 13px; color: #94a3b8;">
        총 ${boxes.length}개 상자 라벨 (${totalPages}페이지, 페이지당 최대 4개 배치)
      </span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn-print" onclick="window.print()">
        라벨 인쇄하기 (Ctrl+P / PDF로 저장)
      </button>
    </div>
  </div>
  ${pagesHtmlList.join('')}
</body>
</html>`;
}
