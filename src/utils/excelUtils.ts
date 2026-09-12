import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  RecordItem,
  DepartmentMeta,
  RetentionPeriod,
  RETENTION_PERIODS,
  TaskCard,
  FullExcelImportResult,
  SaveFileResult,
} from '../types';
import {
  calculateExpiryYear,
  calculateExpiryDate,
  groupRecordsByBox,
  generateRecordId,
  generateRecordNo,
} from './recordUtils';
import { saveBinaryFile } from './fileSaveUtils';

/**
 * public/10. 문서고보존기록대장.xls 공식 표준 탭 순서
 */
export const ARCHIVE_PERIOD_TABS: RetentionPeriod[] = [
  '영구',
  '준영구',
  '30년',
  '10년',
  '5년',
  '3년',
  '1년',
];

/**
 * public/10. 문서고보존기록대장.xls 공식 표준 서식에 맞춘 보존기간별 시트 생성 헬퍼
 * - 영구, 준영구, 30년, 10년, 5년, 3년, 1년 탭 전용
 * - 1행: '문서고 보존기록대장' (A1:N1 병합, 16pt bold)
 * - 2행: '■ 기관(학교)명 : ...' (A2:G2 병합, 10pt bold)
 * - 3~4행: 14개 열 2단 헤더 (관리번호, 생산학교명, 관리학교명, 기록물 일반정보[유형, 생산년도, 종료년도, 보존기간, 보존기간만료일자, 기록물철제목], 위치정보[상자번호, 서가번호], 이력정보[기관(학교)내이관일자, 기록관이관일자, 기록관처리내용])
 * - 색상: 헤더 기본 FFFF99(연노랑), 만료일자(H열) CCFFCC(연초록)
 * - 만료일자(H열): F{r}+G{r}&".12.31." 엑셀 수식 및 CCFFCC 배경 적용 (영구/준영구는 해당 텍스트)
 */
export function buildArchivePeriodSheet(
  ws: ExcelJS.Worksheet,
  period: RetentionPeriod,
  periodRecords: RecordItem[],
  meta: DepartmentMeta
) {
  // 1. 페이지 설정 (A4 가로, 원본 서식 여백 설정)
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.45, right: 0.26, top: 0.67, bottom: 0.39, header: 0.42, footer: 0.29 },
  };

  // 2. 원본 서식 기준 열 너비 (A~N 총 14개 열)
  ws.columns = [
    { width: 12 }, // A: 관리번호
    { width: 10 }, // B: 생산학교명
    { width: 10 }, // C: 관리학교명
    { width: 7 },  // D: 기록물 유형
    { width: 7 },  // E: 생산년도
    { width: 7 },  // F: 종료년도
    { width: 7 },  // G: 보존기간
    { width: 13 }, // H: 보존기간 만료일자
    { width: 36 }, // I: 기록물철제목
    { width: 9 },  // J: 상자번호
    { width: 7 },  // K: 서가번호
    { width: 12 }, // L: 기관(학교)내 이관일자
    { width: 12 }, // M: 기록관 이관 일자
    { width: 12 }, // N: 기록관 처리내용
  ];

  const fontHeader: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 10,
    bold: true,
    color: { argb: 'FF000000' },
  };

  const fontStandard: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 9.5,
    color: { argb: 'FF000000' },
  };

  const borderHeader: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const borderData: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const fillYellowHeader: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF99' },
  };

  const fillGreenExpiry: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFCCFFCC' },
  };

  // ------------------------------------------
  // 1행: 대제목 (A1:N1 병합)
  // ------------------------------------------
  ws.mergeCells('A1:N1');
  const r1 = ws.getRow(1);
  r1.height = 28;
  const cA1 = r1.getCell(1);
  cA1.value = '문서고 보존기록대장';
  cA1.font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF000000' } };
  cA1.alignment = { horizontal: 'center', vertical: 'middle' };

  // ------------------------------------------
  // 2행: 기관(학교)명 (A2:G2 병합) - 처리과명 반영
  // ------------------------------------------
  ws.mergeCells('A2:G2');
  const r2 = ws.getRow(2);
  r2.height = 20;
  const cA2 = r2.getCell(1);
  const deptName = meta.department || '';
  cA2.value = `■ 기관(학교)명 : ${deptName}`;
  cA2.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF000000' } };
  cA2.alignment = { horizontal: 'left', vertical: 'middle' };

  // ------------------------------------------
  // 3~4행: 2단 헤더 병합 및 텍스트 설정
  // ------------------------------------------
  const r3 = ws.getRow(3);
  const r4 = ws.getRow(4);
  r3.height = 20;
  r4.height = 30;

  ws.mergeCells('A3:A4');
  ws.mergeCells('B3:B4');
  ws.mergeCells('C3:C4');
  ws.mergeCells('D3:I3');
  ws.mergeCells('J3:K3');
  ws.mergeCells('L3:N3');

  // 3행 헤더 값
  r3.getCell(1).value = '관리번호';
  r3.getCell(2).value = '생산학교명';
  r3.getCell(3).value = '관리학교명';
  r3.getCell(4).value = '기록물 일반정보';
  r3.getCell(10).value = '기록물 위치정보';
  r3.getCell(12).value = '기록물 이력 정보';

  // 4행 세부 헤더 값
  r4.getCell(4).value = '기록물\n유형';
  r4.getCell(5).value = '생산\n년도';
  r4.getCell(6).value = '종료\n년도';
  r4.getCell(7).value = '보존\n기간';
  r4.getCell(8).value = '보존기간\n만료일자';
  r4.getCell(9).value = '기록물철제목';
  r4.getCell(10).value = '상자번호';
  r4.getCell(11).value = '서가\n번호';
  r4.getCell(12).value = '기관(학교)내\n이관일자';
  r4.getCell(13).value = '기록관\n이관 일자';
  r4.getCell(14).value = '기록관\n처리내용';

  // 3행 및 4행 헤더 스타일링 (1~14열 전체)
  for (let c = 1; c <= 14; c++) {
    const c3 = r3.getCell(c);
    const c4 = r4.getCell(c);

    [c3, c4].forEach((cell) => {
      cell.font = fontHeader;
      cell.border = borderHeader;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // 8열(H열: 보존기간만료일자)는 연초록, 나머지는 연노랑
    c3.fill = fillYellowHeader;
    if (c === 8) {
      c4.fill = fillGreenExpiry;
    } else {
      c4.fill = fillYellowHeader;
    }
  }

  // ------------------------------------------
  // 데이터 행 (5행부터 시작)
  // ------------------------------------------
  const isNumericPeriod = ['30년', '10년', '5년', '3년', '1년'].includes(period);
  const periodNum = isNumericPeriod ? parseInt(period, 10) : period;

  const totalDataRows = periodRecords.length;

  for (let i = 0; i < totalDataRows; i++) {
    const rowNum = 5 + i;
    const row = ws.getRow(rowNum);
    row.height = 21;

    const r = periodRecords[i];

    // H열 만료일자 값 및 수식 (원본 서식 기준)
    let expiryVal: any;
    if (isNumericPeriod) {
      expiryVal = {
        formula: `F${rowNum}+G${rowNum}&".12.31."`,
        result: calculateExpiryDate(r.end_year, r.retention_period),
      };
    } else {
      expiryVal = period; // '영구' or '준영구'
    }

    const defaultDept = meta.department || '';
    // 생산학교명: 별도 지정된 생산부서(학교)가 있으면 사용, 없으면 표지 및 현황의 처리과명(defaultDept) 적용
    const prodSchool =
      r.production_school && r.production_school.trim() !== ''
        ? r.production_school.trim()
        : defaultDept;
    // 관리학교명: 기본적으로 표지 및 현황의 처리과명(defaultDept) 적용
    const mgmtSchool =
      r.management_school && r.management_school.trim() !== ''
        ? r.management_school.trim()
        : defaultDept;

    const vals = [
      r.record_no || r.record_id,
      prodSchool,
      mgmtSchool,
      r.record_type || '일반',
      r.start_year,
      r.end_year,
      isNumericPeriod ? periodNum : period,
      expiryVal,
      r.title,
      r.box_no || '',
      r.shelf_no || '',
      r.internal_transfer_date || '',
      r.transfer_date || '',
      r.transfer_action || (r.is_transferred ? (r.transfer_destination || '기록관 이관') : ''),
    ];

    vals.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.font = fontStandard;
      cell.border = borderData;

      if (cIdx === 7) {
        // H열: 보존기간 만료일자는 원본 양식처럼 연초록 배경
        cell.fill = fillGreenExpiry;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cIdx === 8) {
        // I열: 기록물철제목 좌측 정렬
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  }
}

/**
 * 학교 기록물 관리 표준 엑셀 통합 문서 내보내기 (.xlsx)
 * - 공공기록물 관리 규격 및 기존 학교 보존기록대장 서식(폰트, 셀병합, 테두리, 배경색, 인쇄설정 등) 완벽 재현
 * - 12개 시트 전체 포함:
 *   1. 표지 및 현황
 *   2. 입력 (표준 입력 대장)
 *   3. 영구
 *   4. 준영구
 *   5. 30년
 *   6. 10년
 *   7. 5년
 *   8. 3년
 *   9. 1년
 *   10. 과제카드 (과제카드명, 보존기간, 업무내용)
 *   11. 라벨정보 (상자번호별 묶음 및 수록 기록물 목록)
 *   12. 폐기목록 (폐기 스냅샷 및 폐기일자 이력)
 */
export async function exportRecordsToExcel(
  records: RecordItem[],
  meta: DepartmentMeta,
  taskCards: TaskCard[] = []
): Promise<SaveFileResult> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.lastModifiedBy = meta.manager_name || '행정실';
  wb.created = new Date();
  wb.modified = new Date();

  const fontStandard: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 10,
    color: { argb: 'FF1F2937' },
  };

  const fontHeader: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 10,
    bold: true,
    color: { argb: 'FF1E293B' },
  };

  const fontTitle: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 16,
    bold: true,
    color: { argb: 'FF0F172A' },
  };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const fillHeaderBlue: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' }, // 정부/공공 공문서 표준 청회색
  };

  const fillHeaderLight: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };

  const activeRecords = records.filter((r) => r.is_completed && !r.is_disposed && !r.is_transferred);
  const pendingRecords = records.filter((r) => !r.is_completed && !r.is_disposed && !r.is_transferred);
  const disposedRecords = records.filter((r) => r.is_disposed);
  const transferredRecords = records.filter((r) => r.is_transferred && !r.is_disposed);

  // 보존기간별 건수 집계
  const counts: Record<RetentionPeriod, number> = {
    '영구': 0,
    '준영구': 0,
    '30년': 0,
    '10년': 0,
    '5년': 0,
    '3년': 0,
    '1년': 0,
  };
  activeRecords.forEach((r) => {
    if (counts[r.retention_period] !== undefined) {
      counts[r.retention_period]++;
    }
  });
  const totalCount = activeRecords.length;

  // ==========================================
  // 1. 시트: 표지 및 현황
  // ==========================================
  const wsCover = wb.addWorksheet('표지 및 현황', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  });

  // 열 너비
  wsCover.columns = [
    { width: 18 }, // A
    { width: 15 }, // B
    { width: 12 }, // C
    { width: 12 }, // D
    { width: 12 }, // E
    { width: 12 }, // F
    { width: 12 }, // G
    { width: 12 }, // H
    { width: 12 }, // I
  ];

  // A1: 대제목
  wsCover.mergeCells('A1:I1');
  const titleCell = wsCover.getCell('A1');
  titleCell.value = '문 서 고   보 존 기 록 대 장';
  titleCell.font = fontTitle;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = fillHeaderLight;
  wsCover.getRow(1).height = 42;

  // 메타 정보 (행 3, 4)
  wsCover.getRow(3).height = 24;
  wsCover.getRow(4).height = 24;

  const metaDefs = [
    { labelCell: 'A3', valCell: 'B3', label: '기  준  일  자', val: meta.base_date },
    { labelCell: 'D3', valCell: 'E3:F3', label: '처    리    과', val: meta.department },
    { labelCell: 'A4', valCell: 'B4', label: '기    관    명', val: meta.school_name },
    { labelCell: 'D4', valCell: 'E4:F4', label: '작    성    자', val: meta.manager_name || '행정실장' },
  ];

  metaDefs.forEach((m) => {
    const lCell = wsCover.getCell(m.labelCell);
    lCell.value = m.label;
    lCell.font = fontHeader;
    lCell.alignment = { horizontal: 'center', vertical: 'middle' };
    lCell.fill = fillHeaderLight;
    lCell.border = borderThin;

    if (m.valCell.includes(':')) {
      wsCover.mergeCells(m.valCell);
      const vCell = wsCover.getCell(m.valCell.split(':')[0]);
      vCell.value = m.val;
      vCell.font = fontStandard;
      vCell.alignment = { horizontal: 'center', vertical: 'middle' };
      vCell.border = borderThin;
    } else {
      const vCell = wsCover.getCell(m.valCell);
      vCell.value = m.val;
      vCell.font = fontStandard;
      vCell.alignment = { horizontal: 'center', vertical: 'middle' };
      vCell.border = borderThin;
    }
  });

  // 행 6: 소제목
  wsCover.getCell('A6').value = '[ 보존기간별 기록물 총괄 현황 ]';
  wsCover.getCell('A6').font = { ...fontHeader, size: 12 };
  wsCover.getRow(6).height = 26;

  // 행 7: 집계표 헤더
  const coverTableHeaders = ['구분', '계', '영구', '준영구', '30년', '10년', '5년', '3년', '1년'];
  const row7 = wsCover.getRow(7);
  row7.height = 28;
  coverTableHeaders.forEach((th, idx) => {
    const cell = row7.getCell(idx + 1);
    cell.value = th;
    cell.font = fontHeader;
    cell.fill = fillHeaderBlue;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });

  // 행 8: 집계표 데이터
  const coverTableData = [
    '기록물 수 (권/철)',
    totalCount,
    counts['영구'],
    counts['준영구'],
    counts['30년'],
    counts['10년'],
    counts['5년'],
    counts['3년'],
    counts['1년'],
  ];
  const row8 = wsCover.getRow(8);
  row8.height = 26;
  coverTableData.forEach((val, idx) => {
    const cell = row8.getCell(idx + 1);
    cell.value = val;
    cell.font = idx === 0 ? fontHeader : { ...fontStandard, bold: idx === 1 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });

  // 안내문구
  wsCover.getCell('A10').value = '* 본 보존기록대장은 공공기록물 관리에 관한 법률 시행규칙 서식을 준수하여 자동 생성되었습니다.';
  wsCover.getCell('A10').font = { name: '맑은 고딕', size: 9, color: { argb: 'FF64748B' } };
  wsCover.getCell('A11').value = '* 폐기 처리된 기록물 및 교육청 기록관 이관 기록물은 본 현황 숫자에 포함되지 않으며 「폐기목록」 및 「이관목록」 시트에 별도 안전 보존됩니다.';
  wsCover.getCell('A11').font = { name: '맑은 고딕', size: 9, color: { argb: 'FF64748B' } };

  // ==========================================
  // 2. 시트: 입력 (표준 입력 대장)
  // ==========================================
  const wsInput = wb.addWorksheet('입력', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });
  wsInput.columns = [
    { width: 6 },  // 연번
    { width: 16 }, // 고유번호(record_no)
    { width: 14 }, // 관리ID(record_id)
    { width: 10 }, // 유형
    { width: 10 }, // 생산년도
    { width: 10 }, // 종료년도
    { width: 10 }, // 보존기간
    { width: 40 }, // 기록물철제목
    { width: 16 }, // 생산부서(학교)
    { width: 12 }, // 상자번호
    { width: 12 }, // 서가번호
    { width: 10 }, // 상태
    { width: 14 }, // 등록일시
  ];

  wsInput.mergeCells('A1:M1');
  const inputTitle = wsInput.getCell('A1');
  inputTitle.value = `[ 기록물 신규 등록 대장 ] (미완료 행 ${pendingRecords.length}건 / 표준 서식)`;
  inputTitle.font = { ...fontHeader, size: 13 };
  wsInput.getRow(1).height = 30;

  const inputHeaders = ['연번', '기록물 고유번호', '관리ID', '유형', '생산년도', '종료년도', '보존기간', '기록물철제목', '생산부서(학교)', '상자번호', '서가번호', '상태', '등록일시'];
  const rowInputH = wsInput.getRow(2);
  rowInputH.height = 26;
  inputHeaders.forEach((h, i) => {
    const c = rowInputH.getCell(i + 1);
    c.value = h;
    c.font = fontHeader;
    c.fill = fillHeaderBlue;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  const inputRows = pendingRecords.length > 0 ? pendingRecords : [];
  if (inputRows.length > 0) {
    inputRows.forEach((r, idx) => {
      const row = wsInput.getRow(idx + 3);
      row.height = 22;
      const vals = [
        idx + 1,
        r.record_no || r.record_id,
        r.record_id,
        r.record_type,
        r.start_year,
        r.end_year,
        r.retention_period,
        r.title,
        r.production_school || meta.department,
        r.box_no,
        r.shelf_no,
        '작성중',
        r.created_at,
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = fontStandard;
        cell.border = borderThin;
        cell.alignment =
          cIdx === 7
            ? { horizontal: 'left', vertical: 'middle', wrapText: true }
            : cIdx === 8
            ? { horizontal: 'center', vertical: 'middle' }
            : { horizontal: 'center', vertical: 'middle' };
      });
    });
  } else {
    // 빈 양식 안내
    const emptyRow = wsInput.getRow(3);
    emptyRow.height = 24;
    wsInput.mergeCells('A3:M3');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = '현재 작성 중인 미완료 행이 없습니다. (새로운 기록물은 웹 프로그램 「입력」 화면에서 등록하세요)';
    emptyCell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.border = borderThin;
  }

  // ==========================================
  // 3~9. 시트: 영구, 준영구, 30년, 10년, 5년, 3년, 1년
  // (public/10. 문서고보존기록대장.xls 공식 표준 서식 완벽 적용)
  // ==========================================
  for (const period of ARCHIVE_PERIOD_TABS) {
    const wsPeriod = wb.addWorksheet(period);
    const filtered = activeRecords.filter((r) => r.retention_period === period);
    buildArchivePeriodSheet(wsPeriod, period, filtered, meta);
  }

  // ==========================================
  // 10. 시트: 과제카드
  // ==========================================
  const wsTaskCards = wb.addWorksheet('과제카드', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });
  wsTaskCards.columns = [
    { width: 6 },  // 연번
    { width: 14 }, // 과제카드코드
    { width: 34 }, // 과제카드명
    { width: 14 }, // 보존기간
    { width: 45 }, // 설명 / 주요포함기록물
    { width: 14 }, // 최근수정일
  ];

  wsTaskCards.mergeCells('A1:F1');
  const tcTitle = wsTaskCards.getCell('A1');
  tcTitle.value = `[ 학교 기록물 관리 과제카드 기준표 ] (총 ${taskCards.length}개 기준)`;
  tcTitle.font = { ...fontHeader, size: 13 };
  wsTaskCards.getRow(1).height = 30;

  const tcHeaders = ['연번', '과제카드코드', '과제카드명', '보존기간', '설명 / 주요포함기록물', '최근수정일'];
  const rowTcH = wsTaskCards.getRow(2);
  rowTcH.height = 26;
  tcHeaders.forEach((h, i) => {
    const c = rowTcH.getCell(i + 1);
    c.value = h;
    c.font = fontHeader;
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFCE4D6' }, // 과제카드 전용 연살구색
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  taskCards.forEach((tc, idx) => {
    const row = wsTaskCards.getRow(idx + 3);
    row.height = 22;
    const vals = [idx + 1, tc.id, tc.name, tc.period, tc.description, tc.updated_at];
    vals.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.font = fontStandard;
      cell.border = borderThin;
      cell.alignment =
        cIdx === 2 || cIdx === 4
          ? { horizontal: 'left', vertical: 'middle', wrapText: true }
          : { horizontal: 'center', vertical: 'middle' };
    });
  });

  // ==========================================
  // 11. 시트: 라벨정보
  // ==========================================
  const wsLabels = wb.addWorksheet('라벨정보', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });
  wsLabels.columns = [
    { width: 12 }, // 상자번호
    { width: 14 }, // 서가위치
    { width: 10 }, // 수록 철수
    { width: 18 }, // 생산년도 범위
    { width: 18 }, // 보존기간 구성
    { width: 65 }, // 수록 기록물철 상세 목록
  ];

  wsLabels.mergeCells('A1:F1');
  const lbTitle = wsLabels.getCell('A1');
  lbTitle.value = '[ 보존기록물 상자 라벨 및 서가 배치 목록 ]';
  lbTitle.font = { ...fontHeader, size: 13 };
  wsLabels.getRow(1).height = 30;

  const lbHeaders = ['상자번호', '서가위치', '철 수량', '생산년도 범위', '포함 보존기간', '수록 기록물철 명칭 목록'];
  const rowLbH = wsLabels.getRow(2);
  rowLbH.height = 26;
  lbHeaders.forEach((h, i) => {
    const c = rowLbH.getCell(i + 1);
    c.value = h;
    c.font = fontHeader;
    c.fill = fillHeaderBlue;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  const boxGroups = groupRecordsByBox(records);
  if (boxGroups.length > 0) {
    boxGroups.forEach((bg, idx) => {
      const row = wsLabels.getRow(idx + 3);
      row.height = Math.max(26, bg.records.length * 18);
      const itemListText = bg.records
        .map((r, i) => `${i + 1}. ${r.title} (${r.retention_period})`)
        .join('\n');
      const vals = [
        bg.box_no,
        bg.shelf_no,
        `${bg.record_count}건`,
        bg.year_range,
        bg.retention_periods.join(', '),
        itemListText,
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = fontStandard;
        cell.border = borderThin;
        cell.alignment =
          cIdx === 5
            ? { horizontal: 'left', vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle' };
      });
    });
  } else {
    const emptyRow = wsLabels.getRow(3);
    emptyRow.height = 24;
    wsLabels.mergeCells('A3:F3');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = '등록된 상자 라벨 정보가 없습니다.';
    emptyCell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.border = borderThin;
  }

  // ==========================================
  // 12. 시트: 폐기목록
  // ==========================================
  const wsDisposal = wb.addWorksheet('폐기목록', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });
  wsDisposal.columns = [
    { width: 6 },  // 연번
    { width: 16 }, // 고유번호(record_no)
    { width: 14 }, // 원래 record_id
    { width: 10 }, // 기록물유형
    { width: 10 }, // 생산년도
    { width: 10 }, // 종료년도
    { width: 10 }, // 보존기간
    { width: 44 }, // 기록물철제목
    { width: 12 }, // 폐기당시 상자번호
    { width: 12 }, // 폐기당시 서가번호
    { width: 14 }, // 폐기일자
  ];

  wsDisposal.mergeCells('A1:K1');
  const dpTitle = wsDisposal.getCell('A1');
  dpTitle.value = `[ 보존기록물 폐기 이력 및 보존 스냅샷 대장 ] (총 ${disposedRecords.length}건)`;
  dpTitle.font = { ...fontHeader, size: 13 };
  wsDisposal.getRow(1).height = 30;

  const dpHeaders = [
    '연번',
    '기록물 고유번호',
    '원래 record_id',
    '기록물유형',
    '생산년도',
    '종료년도',
    '보존기간',
    '기록물철제목',
    '상자번호',
    '서가번호',
    '폐기일자',
  ];
  const rowDpH = wsDisposal.getRow(2);
  rowDpH.height = 26;
  dpHeaders.forEach((h, i) => {
    const c = rowDpH.getCell(i + 1);
    c.value = h;
    c.font = fontHeader;
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8CBAD' }, // 폐기목록 전용 연붉은색
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  if (disposedRecords.length > 0) {
    disposedRecords.forEach((r, idx) => {
      const row = wsDisposal.getRow(idx + 3);
      row.height = 22;
      const vals = [
        idx + 1,
        r.record_no || r.record_id,
        r.record_id,
        r.record_type,
        r.start_year,
        r.end_year,
        r.retention_period,
        r.title,
        r.box_no,
        r.shelf_no,
        r.disposal_date || '-',
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = fontStandard;
        cell.border = borderThin;
        cell.alignment =
          cIdx === 6
            ? { horizontal: 'left', vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle' };
      });
    });
  } else {
    const emptyRow = wsDisposal.getRow(3);
    emptyRow.height = 24;
    wsDisposal.mergeCells('A3:J3');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = '현재 폐기 처리된 기록물이 없습니다.';
    emptyCell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.border = borderThin;
  }

  // ==========================================
  // 13. 시트: 이관목록
  // ==========================================
  const wsTransfer = wb.addWorksheet('이관목록', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });
  wsTransfer.columns = [
    { width: 6 },  // 연번
    { width: 16 }, // 고유번호(record_no)
    { width: 14 }, // 원래 record_id
    { width: 10 }, // 기록물유형
    { width: 10 }, // 생산년도
    { width: 10 }, // 종료년도
    { width: 10 }, // 보존기간
    { width: 44 }, // 기록물철제목
    { width: 12 }, // 상자번호
    { width: 12 }, // 서가번호
    { width: 14 }, // 이관일자
    { width: 26 }, // 이관처
  ];

  wsTransfer.mergeCells('A1:L1');
  const trTitle = wsTransfer.getCell('A1');
  trTitle.value = `[ 교육청 기록관 이관 기록물 관리 및 이력 대장 ] (총 ${transferredRecords.length}건)`;
  trTitle.font = { ...fontHeader, size: 13 };
  wsTransfer.getRow(1).height = 30;

  const trHeaders = [
    '연번',
    '기록물 고유번호',
    '원래 record_id',
    '기록물유형',
    '생산년도',
    '종료년도',
    '보존기간',
    '기록물철제목',
    '상자번호',
    '서가번호',
    '이관일자',
    '이관처',
  ];
  const rowTrH = wsTransfer.getRow(2);
  rowTrH.height = 26;
  trHeaders.forEach((h, i) => {
    const c = rowTrH.getCell(i + 1);
    c.value = h;
    c.font = fontHeader;
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }, // 이관목록 전용 연파란색
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  if (transferredRecords.length > 0) {
    transferredRecords.forEach((r, idx) => {
      const row = wsTransfer.getRow(idx + 3);
      row.height = 22;
      const vals = [
        idx + 1,
        r.record_no || r.record_id,
        r.record_id,
        r.record_type,
        r.start_year,
        r.end_year,
        r.retention_period,
        r.title,
        r.box_no || '-',
        r.shelf_no || '-',
        r.transfer_date || '-',
        r.transfer_destination || '전북특별자치도교육청 기록관',
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = fontStandard;
        cell.border = borderThin;
        cell.alignment =
          cIdx === 7
            ? { horizontal: 'left', vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle' };
      });
    });
  } else {
    const emptyRow = wsTransfer.getRow(3);
    emptyRow.height = 24;
    wsTransfer.mergeCells('A3:L3');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = '현재 교육청 기록관으로 이관된 기록물이 없습니다.';
    emptyCell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.border = borderThin;
  }

  // ==========================================
  // 파일 생성 및 다운로드 (Tauri v2 / Electron / Web 통합)
  // ==========================================
  const dateStr = meta.base_date.replace(/-/g, '');
  const fileName = `학교_기록물_관리_보존기록대장_${meta.department}_${dateStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  return await saveBinaryFile(buffer, {
    defaultFileName: fileName,
    title: '보존기록대장 엑셀 통합문서 다른 이름으로 저장',
    filters: [{ name: 'Excel 통합 문서 (*.xlsx)', extensions: ['xlsx'] }],
  });
}

/**
 * 업로드된 엑셀 파일 분석 인터페이스
 */
export interface AnalyzedSheet {
  name: string;
  rowCount: number;
  columns: string[];
  sampleData: Record<string, unknown>[];
}

export interface ExcelAnalysisResult {
  fileName: string;
  sheetCount: number;
  sheets: AnalyzedSheet[];
}

/**
 * 사용자가 업로드한 엑셀 파일 구조 분석 함수
 */
export async function analyzeUploadedExcel(file: File): Promise<ExcelAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  const sheets: AnalyzedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // Convert to json rows
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const rowCount = rows.length;

    let columns: string[] = [];
    let sampleData: Record<string, unknown>[] = [];

    if (rows.length > 0) {
      // Look for first row with at least 2 non-empty string headers
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const r = rows[i];
        if (
          Array.isArray(r) &&
          r.filter((c) => typeof c === 'string' && c.trim().length > 0).length >= 2
        ) {
          headerRowIndex = i;
          break;
        }
      }

      const headerRow = rows[headerRowIndex] || [];
      columns = headerRow.map((c, idx) => (c ? String(c).trim() : `열_${idx + 1}`));

      // Get sample objects
      const jsonObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        range: headerRowIndex,
      });
      sampleData = jsonObjects.slice(0, 5);
    }

    sheets.push({
      name: sheetName,
      rowCount,
      columns,
      sampleData,
    });
  }

  return {
    fileName: file.name,
    sheetCount: wb.SheetNames.length,
    sheets,
  };
}

export interface BatchParsedRecord {
  record_type: '일반' | '시청각';
  start_year: number;
  end_year: number;
  title: string;
  production_school?: string; // 생산부서(학교)
  box_no: string;
  shelf_no: string;
  retention_period?: RetentionPeriod;
}

/**
 * 요구사항 3: 기록물 대량입력용 단순 Excel 서식 파일 다운로드
 * 1행: 안내 문구 (생산부서 관련)
 * 2행: 헤더
 * 3~4행: 예시 2개
 * 5행부터: 사용자 데이터 입력 빈 행 (일관된 셀 서식 유지)
 */
export async function downloadBatchInputExcelTemplate(meta?: DepartmentMeta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  const ws = wb.addWorksheet('기록물 대량입력 서식');

  const defaultDept = meta?.department || '행정실';

  // 열 너비 설정
  ws.columns = [
    { key: 'record_type', width: 14 },
    { key: 'start_year', width: 12 },
    { key: 'end_year', width: 12 },
    { key: 'title', width: 48 },
    { key: 'production_school', width: 22 },
    { key: 'retention_period', width: 16 },
    { key: 'box_no', width: 18 },
    { key: 'shelf_no', width: 14 },
  ];

  // 1행: 안내 문구 (A1:H1 병합)
  ws.mergeCells('A1:H1');
  const r1 = ws.getRow(1);
  r1.height = 30;
  const c1 = r1.getCell(1);
  c1.value = `※ 안내: [생산부서] 열은 처리과와 생산부서가 다른 경우에만 입력하시고, 비워두시면 시스템의 처리과명이 자동 적용됩니다.`;
  c1.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
  c1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF6FF' }, // 연한 블루 틴트
  };
  c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let col = 1; col <= 8; col++) {
    r1.getCell(col).border = {
      top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      left: col === 1 ? { style: 'thin', color: { argb: 'FFBFDBFE' } } : undefined,
      right: col === 8 ? { style: 'thin', color: { argb: 'FFBFDBFE' } } : undefined,
    };
  }

  // 2행: 헤더
  const headers = [
    '기록물 유형',
    '생산년도',
    '종료년도',
    '기록물철제목',
    '생산부서(선택)',
    '보존기간(선택)',
    '상자번호(선택)',
    '서가번호(선택)',
  ];
  const r2 = ws.getRow(2);
  r2.height = 28;
  headers.forEach((h, idx) => {
    const cell = r2.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // 3~4행: 예시 2개 (3행: 기본 처리과 자동적용 예시, 4행: 타부서 직접입력 예시)
  const sampleRows = [
    [
      '일반',
      2026,
      2026,
      '[예시] 2026학년도 교육과정계획 수립 및 운영철',
      '', // 비워두면 시스템의 처리과명이 자동 적용됨
      '10년',
      '1',
      '1',
    ],
    [
      '일반',
      2026,
      2026,
      '[예시] 2026년도 학교발전기금운영 (타부서 생산 시)',
      '폐교초등학교', // 타부서 생산 예시
      '10년',
      '1',
      '2',
    ],
  ];

  sampleRows.forEach((rowVals, sIdx) => {
    const rowNum = 3 + sIdx;
    const r = ws.getRow(rowNum);
    r.height = 23;
    rowVals.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.value = val;
      cell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF64748B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment =
        cIdx === 3
          ? { vertical: 'middle', horizontal: 'left', indent: 1 }
          : { vertical: 'middle', horizontal: 'center' };
    });
  });

  // 5행부터 60행까지: 사용자 실제 입력 행 (일관된 셀 서식 및 테두리 유지)
  const borderDataThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  for (let rNum = 5; rNum <= 60; rNum++) {
    const row = ws.getRow(rNum);
    row.height = 22;
    for (let cIdx = 0; cIdx < 8; cIdx++) {
      const cell = row.getCell(cIdx + 1);
      cell.value = '';
      cell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF1F2937' } };
      cell.border = borderDataThin;
      cell.alignment =
        cIdx === 3
          ? { vertical: 'middle', horizontal: 'left' }
          : { vertical: 'middle', horizontal: 'center' };

      // 드롭다운 데이터 유효성 검사 (입력 편의)
      if (cIdx === 0) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"일반,시청각"'],
        };
      } else if (cIdx === 5) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"영구,준영구,30년,10년,5년,3년,1년"'],
        };
      }
    }
  }

  // 상단 2행 틀 고정 (안내 및 헤더 고정)
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  const buffer = await wb.xlsx.writeBuffer();
  return await saveBinaryFile(buffer, {
    defaultFileName: '학교기록물_대량입력서식.xlsx',
    title: '대량입력서식 엑셀 파일 저장',
    filters: [{ name: 'Excel 통합 문서 (*.xlsx)', extensions: ['xlsx'] }],
  });
}

/**
 * 요구사항 4: 대량입력용 Excel 파일 업로드 및 파싱
 * 여러 행의 기록물을 분석하여 입력대기목록에 일괄 추가할 수 있는 객체 배열 반환
 */
export async function parseBatchInputExcelFile(file: File): Promise<BatchParsedRecord[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  if (rawRows.length === 0) {
    return [];
  }

  // 헤더 행 위치 자동 탐색 (1행 또는 2행 등 상위 10행 이내)
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map((c) => String(c || '').trim()).join(' ');
    if (
      rowStr.includes('기록물철제목') ||
      rowStr.includes('제목') ||
      rowStr.includes('기록물명') ||
      rowStr.includes('생산년도')
    ) {
      headerIndex = i;
      break;
    }
  }

  let colIndices = {
    record_type: -1,
    start_year: -1,
    end_year: -1,
    title: -1,
    production_school: -1,
    retention_period: -1,
    box_no: -1,
    shelf_no: -1,
  };

  if (headerIndex >= 0) {
    const header = rawRows[headerIndex].map((c) => String(c || '').trim());
    header.forEach((h, idx) => {
      if (h.includes('유형') || h.includes('종류') || h.includes('구분')) colIndices.record_type = idx;
      else if (h.includes('생산년') || h.includes('생산연') || h.includes('시작년')) colIndices.start_year = idx;
      else if (h.includes('종료년') || h.includes('종료연')) colIndices.end_year = idx;
      else if (h.includes('기록물철제목') || h.includes('제목') || h.includes('기록물명') || h.includes('철제목')) colIndices.title = idx;
      else if (h.includes('생산부서') || h.includes('생산학교') || h.includes('생산기관') || h.includes('부서명')) colIndices.production_school = idx;
      else if ((h.includes('보존기간') || h.includes('보존년한')) && !h.includes('만료')) colIndices.retention_period = idx;
      else if (h.includes('상자')) colIndices.box_no = idx;
      else if (h.includes('서가') || h.includes('위치')) colIndices.shelf_no = idx;
    });
  } else {
    headerIndex = 0;
    colIndices = {
      record_type: 0,
      start_year: 1,
      end_year: 2,
      title: 3,
      production_school: 4,
      retention_period: 5,
      box_no: 6,
      shelf_no: 7,
    };
  }

  if (colIndices.title === -1) {
    colIndices.title = (rawRows[headerIndex]?.length || 0) > 3 ? 3 : 0;
  }

  const results: BatchParsedRecord[] = [];
  const currentYear = new Date().getFullYear();

  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const titleVal = colIndices.title >= 0 ? String(row[colIndices.title] || '').trim() : '';
    if (!titleVal) continue; // 제목 없는 빈 행 건너뜀

    // 안내 행이나 예시 행 건너뛰기 ([예시], (예시), 예시: 등)
    if (
      titleVal.startsWith('[예시]') ||
      titleVal.startsWith('(예시)') ||
      titleVal.startsWith('예시:') ||
      titleVal.startsWith('[샘플]') ||
      titleVal.includes('[예시') ||
      (titleVal.includes('교육과정계획 수립') && titleVal.includes('예시'))
    ) {
      continue;
    }

    const typeVal = colIndices.record_type >= 0 ? String(row[colIndices.record_type] || '').trim() : '';
    const record_type: '일반' | '시청각' = typeVal.includes('시청각') ? '시청각' : '일반';

    let start_year = colIndices.start_year >= 0 ? parseInt(String(row[colIndices.start_year] || '').replace(/[^0-9]/g, ''), 10) : currentYear;
    if (isNaN(start_year) || start_year < 1900 || start_year > 2100) start_year = currentYear;

    let end_year = colIndices.end_year >= 0 ? parseInt(String(row[colIndices.end_year] || '').replace(/[^0-9]/g, ''), 10) : start_year;
    if (isNaN(end_year) || end_year < 1900 || end_year > 2100) end_year = start_year;

    const prodSchoolVal = colIndices.production_school >= 0 ? String(row[colIndices.production_school] || '').trim() : '';
    const boxVal = colIndices.box_no >= 0 ? String(row[colIndices.box_no] || '').trim() : '';
    const shelfVal = colIndices.shelf_no >= 0 ? String(row[colIndices.shelf_no] || '').trim() : '';

    let periodVal: RetentionPeriod | undefined = undefined;

    if (colIndices.retention_period >= 0) {
      let rawP = String(row[colIndices.retention_period] ?? '')
        .replace(/\u00A0/g, '')
        .replace(/\s+/g, '')
        .trim();

      if (/^\d+$/.test(rawP)) {
        rawP = `${rawP}년`;
      }

      // 준영구를 영구보다 먼저 명확하게 처리
      if (rawP === '준영구') {
        periodVal = '준영구';
      } else if (rawP === '영구') {
        periodVal = '영구';
      } else if (rawP === '30년') {
        periodVal = '30년';
      } else if (rawP === '10년') {
        periodVal = '10년';
      } else if (rawP === '5년') {
        periodVal = '5년';
      } else if (rawP === '3년') {
        periodVal = '3년';
      } else if (rawP === '1년') {
        periodVal = '1년';
      }
    }

    results.push({
      record_type,
      start_year,
      end_year,
      title: titleVal,
      production_school: prodSchoolVal || undefined,
      box_no: boxVal,
      shelf_no: shelfVal,
      retention_period: periodVal,
    });
  }

  return results;
}

/**
 * 특정 보존기간 전용 엑셀 대장 내보내기 (.xlsx) - 요구사항 14
 * - public/10. 문서고보존기록대장.xls 공식 표준 서식 적용
 */
export async function exportPeriodRecordsToExcel(
  period: RetentionPeriod,
  records: RecordItem[],
  meta: DepartmentMeta
) {
  const periodRecords = records.filter(
    (r) => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === period
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.lastModifiedBy = meta.manager_name || '행정실';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet(`${period}`);
  buildArchivePeriodSheet(ws, period, periodRecords, meta);

  const dateStr = meta.base_date.replace(/-/g, '');
  const fileName = `문서고보존기록대장_${period}_${meta.department || meta.school_name || '학교'}_${dateStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  return await saveBinaryFile(buffer, {
    defaultFileName: fileName,
    title: `${period} 문서고 보존기록대장 엑셀 파일 저장`,
    filters: [{ name: 'Excel 통합 문서 (*.xlsx)', extensions: ['xlsx'] }],
  });
}

/**
 * 폐기대상 기록물 엑셀 다운로드 기능
 * 사용자가 설정한 기준연도에 도달한 10년, 5년, 3년, 1년 기록물 목록 추출
 */
export async function exportDisposalTargetsToExcel(
  targets: RecordItem[],
  baseYear: number,
  meta: DepartmentMeta
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.lastModifiedBy = meta.manager_name || '행정실';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet(`폐기대상_${baseYear}년기준`);

  const fontTitle: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 15,
    bold: true,
    color: { argb: 'FF111827' },
  };
  const fontHeader: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  const fontStandard: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 9.5,
    color: { argb: 'FF1F2937' },
  };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  ws.columns = [
    { width: 8 },   // 연번
    { width: 16 },  // 고유번호
    { width: 10 },  // 구분
    { width: 12 },  // 생산년도
    { width: 12 },  // 종료년도
    { width: 45 },  // 기록물철제목
    { width: 12 },  // 보존기간
    { width: 12 },  // 만료연도
    { width: 16 },  // 상자번호
    { width: 14 },  // 서가번호
    { width: 14 },  // 상태
  ];

  // Title Row
  ws.mergeCells('A1:K1');
  const titleRow = ws.getRow(1);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `학교 기록물 폐기대상 목록 (${baseYear}년 기준)`;
  titleCell.font = fontTitle;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Subtitle / Info Row
  ws.mergeCells('A2:K2');
  const subRow = ws.getRow(2);
  subRow.height = 20;
  const subCell = subRow.getCell(1);
  subCell.value = `기관: ${meta.institution || '전북특별자치도교육청'} | 학교/부서: ${meta.school_name || meta.department || '전북초등학교'} | 대상 건수: 총 ${targets.length}건 | 출력일: ${new Date().toISOString().slice(0, 10)}`;
  subCell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Headers Row
  const headers = [
    '연번',
    '기록물 고유번호',
    '구분',
    '생산년도',
    '종료년도',
    '기록물철제목',
    '보존기간',
    '만료연도',
    '상자번호',
    '서가번호',
    '구분상태',
  ];
  const hRow = ws.getRow(3);
  hRow.height = 25;
  headers.forEach((h, idx) => {
    const cell = hRow.getCell(idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFBE123C' }, // Rose color for disposal
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });

  if (targets.length > 0) {
    targets.forEach((r, idx) => {
      const row = ws.getRow(idx + 4);
      row.height = 22;
      const expiry = calculateExpiryYear(r.end_year, r.retention_period);
      const statusText = r.is_disposal_deferred ? '보류' : '폐기대상';

      const rowValues = [
        idx + 1,
        r.record_no || r.record_id,
        r.record_type || '일반',
        r.start_year,
        r.end_year,
        r.title,
        r.retention_period,
        expiry,
        r.box_no || '-',
        r.shelf_no || '-',
        statusText,
      ];

      rowValues.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = val;
        cell.font = fontStandard;
        cell.border = borderThin;
        cell.alignment =
          cIdx === 5
            ? { horizontal: 'left', vertical: 'middle' }
            : { horizontal: 'center', vertical: 'middle' };
      });
    });
  } else {
    ws.mergeCells('A4:K4');
    const emptyRow = ws.getRow(4);
    emptyRow.height = 28;
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = `기준연도 ${baseYear}년 기준 폐기대상 기록물이 없습니다.`;
    emptyCell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.border = borderThin;
  }

  const fileName = `폐기대상기록물목록_${baseYear}년기준_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  return await saveBinaryFile(buffer, {
    defaultFileName: fileName,
    title: '폐기대상 기록물 목록 엑셀 저장',
    filters: [{ name: 'Excel 통합 문서 (*.xlsx)', extensions: ['xlsx'] }],
  });
}

/**
 * 이관목록 전용 엑셀 대장 내보내기 (.xlsx)
 */
export async function exportTransferRecordsToExcel(
  records: RecordItem[],
  meta: DepartmentMeta
) {
  const transferredRecords = records.filter((r) => r.is_transferred && !r.is_disposed);
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.lastModifiedBy = meta.manager_name || '행정실';
  wb.created = new Date();
  wb.modified = new Date();

  const fontStandard: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 10,
    color: { argb: 'FF1F2937' },
  };

  const fontHeader: Partial<ExcelJS.Font> = {
    name: '맑은 고딕',
    size: 10,
    bold: true,
    color: { argb: 'FF1E293B' },
  };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const ws = wb.addWorksheet('이관목록', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 6 },  // 연번
    { width: 16 }, // 고유번호
    { width: 14 }, // 관리번호
    { width: 10 }, // 유형
    { width: 10 }, // 생산년도
    { width: 10 }, // 종료년도
    { width: 10 }, // 보존기간
    { width: 44 }, // 기록물철제목
    { width: 12 }, // 상자번호
    { width: 12 }, // 서가번호
    { width: 14 }, // 이관일자
    { width: 28 }, // 이관처
  ];

  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  const instName = meta.institution || meta.school_name || '전북특별자치도교육청';
  titleCell.value = `[${instName}] ${meta.department} - 교육청 기록관 이관 기록물 관리 및 이력 대장 (총 ${transferredRecords.length}건)`;
  titleCell.font = { name: '맑은 고딕', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 32;

  const headers = [
    '연번',
    '기록물 고유번호',
    '관리번호',
    '유형',
    '생산년도',
    '종료년도',
    '보존기간',
    '기록물철제목',
    '상자번호',
    '서가번호',
    '이관일자',
    '이관처',
  ];

  const rowH = ws.getRow(2);
  rowH.height = 26;
  headers.forEach((h, i) => {
    const c = rowH.getCell(i + 1);
    c.value = h;
    c.font = fontHeader;
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  if (transferredRecords.length > 0) {
    transferredRecords.forEach((r, idx) => {
      const row = ws.getRow(idx + 3);
      row.height = 22;
      const vals = [
        idx + 1,
        r.record_no || r.record_id,
        r.record_id,
        r.record_type,
        r.start_year,
        r.end_year,
        r.retention_period,
        r.title,
        r.box_no || '-',
        r.shelf_no || '-',
        r.transfer_date || '-',
        r.transfer_destination || '전북특별자치도교육청 기록관',
      ];
      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = fontStandard;
        cell.border = borderThin;
        cell.alignment =
          cIdx === 7
            ? { horizontal: 'left', vertical: 'middle', wrapText: true }
            : { horizontal: 'center', vertical: 'middle' };
      });
    });
  } else {
    const emptyRow = ws.getRow(3);
    emptyRow.height = 24;
    ws.mergeCells('A3:L3');
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = '현재 교육청 기록관으로 이관된 기록물이 없습니다.';
    emptyCell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF94A3B8' } };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.border = borderThin;
  }

  const dateStr = meta.base_date.replace(/-/g, '');
  const fileName = `기록관_이관기록물_관리대장_${meta.department}_${dateStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  return await saveBinaryFile(buffer, {
    defaultFileName: fileName,
    title: '이관기록물 관리대장 엑셀 파일 저장',
    filters: [{ name: 'Excel 통합 문서 (*.xlsx)', extensions: ['xlsx'] }],
  });
}

/**
 * 엑셀 셀 값의 날짜를 YYYY-MM-DD 문자열로 안전하게 변환
 */
function normalizeExcelDate(val: any, fallback?: string): string {
  if (val === undefined || val === null || val === '') {
    return fallback || new Date().toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // 엑셀 시리얼 날짜 (1900년 기준)
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        const y = String(dateObj.y).padStart(4, '0');
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // ignore
    }
  }
  const str = String(val).trim();
  // 정규식 매칭 YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const m = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return str || fallback || new Date().toISOString().split('T')[0];
}

/**
 * 요구사항: 다른 컴퓨터 등에서 [Excel 내보내기]로 저장한 .xlsx 파일을 읽어와
 * 전체 대장 데이터(보존대장, 입력대기, 폐기, 이관, 과제카드, 기관설정)를 복원할 수 있도록 완벽 파싱
 */
export async function parseFullExcelBackupFile(file: File): Promise<FullExcelImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = wb.SheetNames || [];

  if (sheetNames.length === 0) {
    throw new Error('선택하신 엑셀 파일에 시트가 존재하지 않습니다.');
  }

  const existingIds = new Set<string>();
  const parsedRecords: RecordItem[] = [];
  const parsedTaskCards: TaskCard[] = [];
  const parsedMeta: Partial<DepartmentMeta> = {};

  // 보존기간 유효성 검사용 Set
  const validPeriods = new Set<string>(['준영구', '영구', '30년', '10년', '5년', '3년', '1년']);

  // ----------------------------------------------------
  // 1. [표지 및 현황] 시트 파싱 (기관명, 처리과, 기준일자, 작성자)
  // ----------------------------------------------------
  const coverSheetName = sheetNames.find(
    (name) => name.includes('표지') || name.includes('현황') || name === 'Cover'
  );
  if (coverSheetName) {
    const ws = wb.Sheets[coverSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const text = String(row[c] || '').replace(/\s+/g, '');
        const nextVal = row[c + 1] !== undefined ? String(row[c + 1]).trim() : '';

        if (text.includes('기준일자') && nextVal) {
          parsedMeta.base_date = normalizeExcelDate(row[c + 1], parsedMeta.base_date);
        } else if (text.includes('처리과') && nextVal) {
          parsedMeta.department = nextVal;
        } else if ((text.includes('기관명') || text.includes('학교명')) && nextVal) {
          parsedMeta.school_name = nextVal;
        } else if (text.includes('작성자') && nextVal) {
          parsedMeta.manager_name = nextVal;
        }
      }
    }
  }

  // 10. 문서고보존기록대장.xls 서식처럼 표지 시트 없이 바로 2행에 '■ 기관(학교)명 : [학교명]'이 있는 경우 대응
  if (!parsedMeta.school_name) {
    for (const sName of sheetNames) {
      const ws = wb.Sheets[sName];
      if (!ws) continue;
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;
        const line = row.join(' ');
        if (line.includes('기관(학교)명') || line.includes('기관명') || line.includes('학교명')) {
          const match = line.match(/(?:기관\(학교\)명|기관명|학교명)\s*[:：]\s*([^\s,]+)/);
          if (match && match[1]) {
            parsedMeta.school_name = match[1].trim();
            break;
          }
        }
      }
      if (parsedMeta.school_name) break;
    }
  }

  // ----------------------------------------------------
  // 시트 파싱 헬퍼 함수
  // ----------------------------------------------------
  const parseRowsFromSheet = (
    sheetName: string,
    defaultPeriod?: RetentionPeriod,
    statusOverride?: { isCompleted?: boolean; isDisposed?: boolean; isTransferred?: boolean }
  ) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (rawRows.length < 2) return;

    // 헤더 행 탐색 (단일 행 또는 2단 헤더)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((cell) => String(cell || '').replace(/\s+/g, '')).join(' ');
      if (
        rowStr.includes('기록물철제목') ||
        rowStr.includes('철제목') ||
        rowStr.includes('제목') ||
        rowStr.includes('기록물명') ||
        rowStr.includes('생산년도') ||
        rowStr.includes('고유번호') ||
        rowStr.includes('관리번호')
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx < 0) return;

    const currentRow = (rawRows[headerIdx] || []).map((c: any) => String(c || '').replace(/\s+/g, ''));
    const prevRow = headerIdx > 0 ? (rawRows[headerIdx - 1] || []).map((c: any) => String(c || '').replace(/\s+/g, '')) : [];

    const colIdx = {
      record_no: -1,
      record_id: -1,
      production_school: -1,
      management_school: -1,
      record_type: -1,
      start_year: -1,
      end_year: -1,
      retention_period: -1,
      title: -1,
      box_no: -1,
      shelf_no: -1,
      internal_transfer_date: -1,
      transfer_action: -1,
      created_at: -1,
      disposal_date: -1,
      transfer_date: -1,
      transfer_destination: -1,
    };

    const maxCols = Math.max(currentRow.length, prevRow.length);
    for (let idx = 0; idx < maxCols; idx++) {
      const cur = currentRow[idx] || '';
      const prev = prevRow[idx] || '';
      const combined = `${prev}_${cur}`;

      if (cur.includes('고유번호') || cur.includes('관리번호') || cur.includes('연번')) {
        if (colIdx.record_no === -1) colIdx.record_no = idx;
      }
      if (cur.includes('관리id') || cur.includes('원래record_id')) colIdx.record_id = idx;
      if (cur.includes('생산학교') || cur.includes('생산기관') || cur.includes('생산부서') || combined.includes('생산학교') || combined.includes('생산부서')) colIdx.production_school = idx;
      if (cur.includes('관리학교') || cur.includes('관리기관') || cur.includes('관리부서') || combined.includes('관리학교') || combined.includes('관리부서')) colIdx.management_school = idx;
      if (cur.includes('유형') || cur.includes('종류')) colIdx.record_type = idx;
      if (cur.includes('생산년') || cur.includes('생산연') || cur.includes('시작년')) colIdx.start_year = idx;
      if (cur.includes('종료년') || cur.includes('종료연')) colIdx.end_year = idx;
      if ((cur.includes('보존기간') || cur.includes('보존년한')) && !cur.includes('만료')) colIdx.retention_period = idx;
      if (cur.includes('기록물철제목') || cur.includes('철제목') || cur.includes('기록물명') || (cur === '제목')) colIdx.title = idx;
      if (cur.includes('상자')) colIdx.box_no = idx;
      if (cur.includes('서가') || cur.includes('위치')) colIdx.shelf_no = idx;
      if (cur.includes('기관내이관') || cur.includes('학교내이관') || combined.includes('기관(학교)내이관')) colIdx.internal_transfer_date = idx;
      if (cur.includes('기록관이관') || cur.includes('이관일자') || cur.includes('이관일')) colIdx.transfer_date = idx;
      if (cur.includes('처리내용') || cur.includes('이관처') || cur.includes('인수기관')) {
        colIdx.transfer_action = idx;
        colIdx.transfer_destination = idx;
      }
      if (cur.includes('등록일시') || cur.includes('등록일')) colIdx.created_at = idx;
      if (cur.includes('폐기일자') || cur.includes('폐기일')) colIdx.disposal_date = idx;
    }

    // 10. 문서고보존기록대장.xls 14열 표준 기본 위치 매핑 (만약 헤더 텍스트 탐색 누락 시 안전 백업)
    if (colIdx.title === -1 && currentRow.length >= 9) {
      colIdx.record_no = colIdx.record_no === -1 ? 0 : colIdx.record_no;
      colIdx.production_school = colIdx.production_school === -1 ? 1 : colIdx.production_school;
      colIdx.management_school = colIdx.management_school === -1 ? 2 : colIdx.management_school;
      colIdx.record_type = colIdx.record_type === -1 ? 3 : colIdx.record_type;
      colIdx.start_year = colIdx.start_year === -1 ? 4 : colIdx.start_year;
      colIdx.end_year = colIdx.end_year === -1 ? 5 : colIdx.end_year;
      colIdx.retention_period = colIdx.retention_period === -1 ? 6 : colIdx.retention_period;
      colIdx.title = 8; // I열
      colIdx.box_no = colIdx.box_no === -1 ? 9 : colIdx.box_no;
      colIdx.shelf_no = colIdx.shelf_no === -1 ? 10 : colIdx.shelf_no;
      colIdx.internal_transfer_date = colIdx.internal_transfer_date === -1 ? 11 : colIdx.internal_transfer_date;
      colIdx.transfer_date = colIdx.transfer_date === -1 ? 12 : colIdx.transfer_date;
      colIdx.transfer_action = colIdx.transfer_action === -1 ? 13 : colIdx.transfer_action;
    }

    if (colIdx.title < 0) return;

    // 데이터 행 순회
    for (let rIdx = headerIdx + 1; rIdx < rawRows.length; rIdx++) {
      const row = rawRows[rIdx];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawTitle = row[colIdx.title] !== undefined ? String(row[colIdx.title]).trim() : '';
      if (!rawTitle) continue;

      // 안내 문구 및 헤더 잔여 행 건너뛰기
      if (
        rawTitle.includes('등록된 기록물이 없습니다') ||
        rawTitle.includes('미완료 행이 없습니다') ||
        rawTitle.includes('폐기 처리된 기록물이 없습니다') ||
        rawTitle.includes('이관된 기록물이 없습니다') ||
        rawTitle.startsWith('* 본 보존기록대장') ||
        rawTitle.startsWith('■') ||
        rawTitle === '기록물철제목' ||
        rawTitle === '제목'
      ) {
        continue;
      }

      // 보존기간 결정
      let rawPeriod =
        colIdx.retention_period >= 0 && row[colIdx.retention_period] !== undefined
          ? String(row[colIdx.retention_period]).trim()
          : '';
      if (/^\d+$/.test(rawPeriod)) {
        rawPeriod = `${rawPeriod}년`;
      }
      if (!validPeriods.has(rawPeriod)) {
        if (defaultPeriod && validPeriods.has(defaultPeriod)) {
          rawPeriod = defaultPeriod;
        } else {
          rawPeriod = '5년'; // 기본값
        }
      }
      const period = rawPeriod as RetentionPeriod;

      // 생산년도 / 종료년도 파싱
      const currentYear = new Date().getFullYear();
      let startYear = currentYear;
      if (colIdx.start_year >= 0 && row[colIdx.start_year] !== undefined) {
        const parsed = parseInt(String(row[colIdx.start_year]).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) startYear = parsed;
      }

      let endYear = startYear;
      if (colIdx.end_year >= 0 && row[colIdx.end_year] !== undefined) {
        const parsed = parseInt(String(row[colIdx.end_year]).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) endYear = parsed;
      }

      // 유형 파싱
      let recType: '일반' | '시청각' = '일반';
      if (colIdx.record_type >= 0 && row[colIdx.record_type] !== undefined) {
        const tStr = String(row[colIdx.record_type]).trim();
        if (tStr.includes('시청각')) recType = '시청각';
      }

      // 고유 ID 및 번호
      let rawId =
        colIdx.record_id >= 0 && row[colIdx.record_id] !== undefined
          ? String(row[colIdx.record_id]).trim()
          : '';
      if (!rawId || existingIds.has(rawId)) {
        rawId = generateRecordId(Array.from(existingIds));
      }
      existingIds.add(rawId);

      let rawNo =
        colIdx.record_no >= 0 && row[colIdx.record_no] !== undefined
          ? String(row[colIdx.record_no]).trim()
          : '';
      if (!rawNo) {
        rawNo = generateRecordNo(period, parsedRecords);
      }

      // 생산학교명 / 관리학교명
      const prodSchool =
        colIdx.production_school >= 0 && row[colIdx.production_school] !== undefined
          ? String(row[colIdx.production_school]).trim()
          : undefined;
      const mgmtSchool =
        colIdx.management_school >= 0 && row[colIdx.management_school] !== undefined
          ? String(row[colIdx.management_school]).trim()
          : undefined;

      // 상자번호 / 서가번호
      const boxNo =
        colIdx.box_no >= 0 && row[colIdx.box_no] !== undefined
          ? String(row[colIdx.box_no]).trim()
          : '';
      const shelfNo =
        colIdx.shelf_no >= 0 && row[colIdx.shelf_no] !== undefined
          ? String(row[colIdx.shelf_no]).trim()
          : '';

      const createdAt =
        colIdx.created_at >= 0 && row[colIdx.created_at] !== undefined
          ? normalizeExcelDate(row[colIdx.created_at])
          : new Date().toISOString().split('T')[0];

      const disposalDate =
        colIdx.disposal_date >= 0 && row[colIdx.disposal_date] !== undefined
          ? normalizeExcelDate(row[colIdx.disposal_date])
          : undefined;

      const internalTransferDate =
        colIdx.internal_transfer_date >= 0 && row[colIdx.internal_transfer_date] !== undefined
          ? normalizeExcelDate(row[colIdx.internal_transfer_date], String(row[colIdx.internal_transfer_date]).trim())
          : undefined;

      const transferDate =
        colIdx.transfer_date >= 0 && row[colIdx.transfer_date] !== undefined && String(row[colIdx.transfer_date]).trim() !== ''
          ? normalizeExcelDate(row[colIdx.transfer_date], String(row[colIdx.transfer_date]).trim())
          : undefined;

      const transferAction =
        colIdx.transfer_action >= 0 && row[colIdx.transfer_action] !== undefined
          ? String(row[colIdx.transfer_action]).trim()
          : undefined;

      const transferDest =
        colIdx.transfer_destination >= 0 && row[colIdx.transfer_destination] !== undefined
          ? String(row[colIdx.transfer_destination]).trim()
          : undefined;

      const isCompleted = statusOverride?.isCompleted ?? true;
      const isDisposed = statusOverride?.isDisposed ?? false;
      const isTransferred =
        statusOverride?.isTransferred ??
        Boolean(transferDate || (transferAction && transferAction.includes('이관')));

      parsedRecords.push({
        record_id: rawId,
        record_no: rawNo,
        record_type: recType,
        start_year: startYear,
        end_year: endYear,
        retention_period: period,
        title: rawTitle,
        box_no: boxNo,
        shelf_no: shelfNo,
        production_school: prodSchool || parsedMeta.school_name || undefined,
        management_school: mgmtSchool || parsedMeta.school_name || undefined,
        internal_transfer_date: internalTransferDate,
        transfer_action: transferAction,
        is_completed: isCompleted,
        is_disposed: isDisposed,
        disposal_date: isDisposed ? disposalDate || new Date().toISOString().split('T')[0] : undefined,
        is_disposal_deferred: false,
        is_transferred: isTransferred,
        transfer_date: isTransferred ? transferDate || new Date().toISOString().split('T')[0] : null,
        transfer_destination: isTransferred ? transferDest || transferAction || '전북특별자치도교육청 기록관' : null,
        created_at: createdAt,
        updated_at: new Date().toISOString().split('T')[0],
      });
    }
  };

  // ----------------------------------------------------
  // 2. 보존기간별 시트 파싱 ('영구', '준영구', '30년', '10년', '5년', '3년', '1년')
  // ----------------------------------------------------
  const periodSheets = ['영구', '준영구', '30년', '10년', '5년', '3년', '1년'] as RetentionPeriod[];
  let foundPeriodSheet = false;
  for (const period of periodSheets) {
    const sheetName = sheetNames.find(
      (name) => name.trim() === period || name.includes(`[${period}]`) || name.startsWith(period)
    );
    if (sheetName) {
      foundPeriodSheet = true;
      parseRowsFromSheet(sheetName, period, {
        isCompleted: true,
        isDisposed: false,
        isTransferred: false,
      });
    }
  }

  // ----------------------------------------------------
  // 3. [입력] 시트 파싱 (미완료 행 복원)
  // ----------------------------------------------------
  const inputSheetName = sheetNames.find(
    (name) => name.trim() === '입력' || name.includes('신규') || name.includes('대량입력')
  );
  if (inputSheetName) {
    parseRowsFromSheet(inputSheetName, '5년', {
      isCompleted: false,
      isDisposed: false,
      isTransferred: false,
    });
  }

  // ----------------------------------------------------
  // 4. [폐기목록] 시트 파싱
  // ----------------------------------------------------
  const disposalSheetName = sheetNames.find(
    (name) => name.includes('폐기목록') || name.includes('폐기대장') || name.trim() === '폐기'
  );
  if (disposalSheetName) {
    parseRowsFromSheet(disposalSheetName, '5년', {
      isCompleted: true,
      isDisposed: true,
      isTransferred: false,
    });
  }

  // ----------------------------------------------------
  // 5. [이관목록] 시트 파싱
  // ----------------------------------------------------
  const transferSheetName = sheetNames.find(
    (name) => name.includes('이관목록') || name.includes('이관대장') || name.trim() === '이관'
  );
  if (transferSheetName) {
    parseRowsFromSheet(transferSheetName, '영구', {
      isCompleted: true,
      isDisposed: false,
      isTransferred: true,
    });
  }

  // ----------------------------------------------------
  // 6. [과제카드] 시트 파싱
  // ----------------------------------------------------
  const taskCardSheetName = sheetNames.find(
    (name) => name.includes('과제카드') || name.includes('TaskCard')
  );
  if (taskCardSheetName) {
    const ws = wb.Sheets[taskCardSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    let tcHeaderIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 6); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c || '').replace(/\s+/g, '')).join(' ');
      if (rowStr.includes('과제카드명') || rowStr.includes('과제카드코드')) {
        tcHeaderIdx = i;
        break;
      }
    }

    if (tcHeaderIdx >= 0) {
      const header = rawRows[tcHeaderIdx].map((c) => String(c || '').replace(/\s+/g, ''));
      const codeIdx = header.findIndex((h) => h.includes('코드') || h.includes('id'));
      const nameIdx = header.findIndex((h) => h.includes('과제카드명') || h.includes('카드명') || h.includes('명칭'));
      const periodIdx = header.findIndex((h) => h.includes('보존기간') || h.includes('기간'));
      const descIdx = header.findIndex((h) => h.includes('설명') || h.includes('내용') || h.includes('포함기록물'));
      const dateIdx = header.findIndex((h) => h.includes('수정일') || h.includes('등록일'));

      if (nameIdx >= 0) {
        for (let r = tcHeaderIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!Array.isArray(row)) continue;
          const name = row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '';
          if (!name || name.includes('기준이 없습니다')) continue;

          let period =
            periodIdx >= 0 && row[periodIdx] !== undefined ? String(row[periodIdx]).trim() : '5년';
          if (!validPeriods.has(period)) period = '5년';

          const id =
            codeIdx >= 0 && row[codeIdx] !== undefined && String(row[codeIdx]).trim()
              ? String(row[codeIdx]).trim()
              : `TC-${String(parsedTaskCards.length + 1).padStart(3, '0')}`;

          const desc = descIdx >= 0 && row[descIdx] !== undefined ? String(row[descIdx]).trim() : '';
          const updatedAt =
            dateIdx >= 0 && row[dateIdx] !== undefined
              ? normalizeExcelDate(row[dateIdx])
              : new Date().toISOString().split('T')[0];

          parsedTaskCards.push({
            id,
            name,
            period: period as RetentionPeriod,
            description: desc,
            created_at: updatedAt,
            updated_at: updatedAt,
          });
        }
      }
    }
  }

  // ----------------------------------------------------
  // 7. Fallback: 만약 보존기간별 시트 등이 하나도 감지되지 않고 일반 단일 시트 파일인 경우
  // ----------------------------------------------------
  if (!foundPeriodSheet && parsedRecords.length === 0) {
    for (const sName of sheetNames) {
      if (sName.includes('표지') || sName.includes('라벨')) continue;
      parseRowsFromSheet(sName, '5년', {
        isCompleted: true,
        isDisposed: false,
        isTransferred: false,
      });
      if (parsedRecords.length > 0) break;
    }
  }

  // 통계 계산
  const activeRecords = parsedRecords.filter((r) => r.is_completed && !r.is_disposed && !r.is_transferred);
  const pendingRecords = parsedRecords.filter((r) => !r.is_completed && !r.is_disposed && !r.is_transferred);
  const disposedRecords = parsedRecords.filter((r) => r.is_disposed);
  const transferredRecords = parsedRecords.filter((r) => r.is_transferred && !r.is_disposed);

  return {
    records: parsedRecords,
    meta: Object.keys(parsedMeta).length > 0 ? parsedMeta : undefined,
    taskCards: parsedTaskCards.length > 0 ? parsedTaskCards : undefined,
    stats: {
      totalRecords: parsedRecords.length,
      activeRecords: activeRecords.length,
      pendingRecords: pendingRecords.length,
      disposedRecords: disposedRecords.length,
      transferredRecords: transferredRecords.length,
      taskCardsCount: parsedTaskCards.length,
    },
    sourceFileName: file.name,
  };
}

