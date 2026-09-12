import ExcelJS from 'exceljs';
import { DepartmentMeta, SaveFileResult } from '../types';
import { saveBinaryFile } from './fileSaveUtils';

// 공통 스타일 정의
const fontTitle: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 16,
  bold: true,
  color: { argb: 'FF0F172A' },
};

const fontSubtitle: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 11,
  bold: true,
  color: { argb: 'FF334155' },
};

const fontHeader: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 10,
  bold: true,
  color: { argb: 'FF1E293B' },
};

const fontBody: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 9.5,
  color: { argb: 'FF334155' },
};

const fontNotice: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 8.5,
  color: { argb: 'FF64748B' },
};

const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } },
};

const borderMedium: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF334155' } },
  left: { style: 'medium', color: { argb: 'FF334155' } },
  bottom: { style: 'medium', color: { argb: 'FF334155' } },
  right: { style: 'medium', color: { argb: 'FF334155' } },
};

const fillHeaderSlate: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF1F5F9' },
};

const fillHeaderBlue: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0F2FE' },
};

// 파일 다운로드 헬퍼 (Tauri v2 / Electron / Web 통합)
export async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<SaveFileResult> {
  const buffer = await wb.xlsx.writeBuffer();
  return await saveBinaryFile(buffer, {
    defaultFileName: fileName,
    title: '행정 업무서식 엑셀 파일 저장',
    filters: [{ name: 'Excel 통합 문서 (*.xlsx)', extensions: ['xlsx'] }],
  });
}

/**
 * 1. 기록물관리 책임자 지정 (변경) 통보서
 * 근거: 공공기록물 관리에 관한 법률 시행령 제12조
 */
export async function generateRecordManagerForm(meta: DepartmentMeta): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.created = new Date();

  const ws = wb.addWorksheet('기록물관리책임자 지정통보서', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 22 },
    { width: 20 },
  ];

  // 여백 및 제목
  ws.addRow([]);
  ws.mergeCells('A2:F2');
  const titleCell = ws.getCell('A2');
  titleCell.value = '기록물관리책임자 지정(변경) 통보서';
  titleCell.font = fontTitle;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 36;

  ws.mergeCells('A3:F3');
  const lawCell = ws.getCell('A3');
  lawCell.value = '【관련 근거: 「공공기록물 관리에 관한 법률 시행령」 제12조(처리과의 기록물관리)】';
  lawCell.font = { ...fontNotice, bold: true, color: { argb: 'FF475569' } };
  lawCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 20;

  ws.addRow([]);

  // 기본 정보 요약표
  const schoolName = meta.school_name || '오봉초등학교';
  const deptName = meta.department || '교무실';
  const baseDate = meta.base_date || new Date().toISOString().split('T')[0];

  const infoRows = [
    ['기 관 명', schoolName, '처 리 과', deptName],
    ['통 보 일 자', baseDate, '문 서 번 호', `${deptName}-2026-기록관리`],
  ];

  infoRows.forEach((r) => {
    const row = ws.addRow([r[0], r[1], '', r[2], r[3], '']);
    row.height = 24;
    const rowIndex = row.number;
    ws.mergeCells(`B${rowIndex}:C${rowIndex}`);
    ws.mergeCells(`E${rowIndex}:F${rowIndex}`);

    [1, 4].forEach((c) => {
      const cell = row.getCell(c);
      cell.fill = fillHeaderSlate;
      cell.font = fontHeader;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderThin;
    });

    [2, 3, 5, 6].forEach((c) => {
      const cell = row.getCell(c);
      cell.font = fontBody;
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = borderThin;
    });
  });

  ws.addRow([]);

  // 지정 내역 본문 테이블 헤더
  const tableHeaderRow = ws.addRow([
    '구분',
    '소속 부서',
    '직급 / 직위',
    '성명',
    '담당 기록관리 업무',
    '비고 (연락처 등)',
  ]);
  tableHeaderRow.height = 28;
  tableHeaderRow.eachCell((cell) => {
    cell.fill = fillHeaderBlue;
    cell.font = fontHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderMedium;
  });

  // 데이터 행 (기본 정/부 2명 양식)
  const sampleData = [
    ['정(책임자)', deptName, '행정주사 / 주무관', meta.manager_name || '서동혁', '처리과 기록물 총괄 편철·등록 및 이관', '내선 063-000-0000'],
    ['부(담당자)', deptName, '교사 / 실무사', '홍길동', '기록물 편철 보조 및 전산 등록', '내선 063-000-0000'],
    ['변경 내역', '해당시 기재', '전임자 직급', '전임자 성명', '변경 사유 (인사이동, 업무분장 등)', '변경일: ' + baseDate],
  ];

  sampleData.forEach((rowVals) => {
    const row = ws.addRow(rowVals);
    row.height = 26;
    row.eachCell((cell, colIdx) => {
      cell.font = fontBody;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 1 || colIdx === 3 || colIdx === 4 ? 'center' : 'left',
        vertical: 'middle',
      };
    });
  });

  ws.addRow([]);

  // 결재란 표
  const signTitleRow = ws.addRow(['결', '기안자', '검토자', '학교장(기관장)', '', '']);
  signTitleRow.height = 22;
  ws.mergeCells(`D${signTitleRow.number}:F${signTitleRow.number}`);
  [1, 2, 3, 4, 5, 6].forEach((colIdx) => {
    const c = signTitleRow.getCell(colIdx);
    c.fill = fillHeaderSlate;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  const signBodyRow = ws.addRow(['재', '', '', '', '', '']);
  signBodyRow.height = 48;
  ws.mergeCells(`D${signBodyRow.number}:F${signBodyRow.number}`);
  [1, 2, 3, 4, 5, 6].forEach((colIdx) => {
    const c = signBodyRow.getCell(colIdx);
    c.font = fontBody;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  ws.addRow([]);

  // 하단 안내 박스
  const noticeRow = ws.addRow([
    '※ 기록물관리책임자의 주요 임무 (영 제12조):\n' +
      ' 1. 처리과의 기록물의 생산·등록의 총괄 및 점검\n' +
      ' 2. 처리과의 기록물철 작성기준표 작성 및 관리\n' +
      ' 3. 처리과의 보존기간 만료 기록물의 이관 및 관리 대장 작성\n' +
      ' 4. 매년 기록물 정리기간(3월~5월) 내 전년도 생산 기록물 이관 준비',
  ]);
  ws.mergeCells(`A${noticeRow.number}:F${noticeRow.number}`);
  noticeRow.height = 65;
  const nCell = noticeRow.getCell(1);
  nCell.font = fontNotice;
  nCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  nCell.border = borderThin;
  nCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  await downloadWorkbook(wb, `기록물관리_책임자_지정통보서_${schoolName}_${baseDate}.xlsx`);
}

/**
 * 2. 기록물 반출입대장
 * 근거: 공공기록물 관리에 관한 법률 시행규칙 제16조
 */
export async function generateRecordsInOutLogForm(meta: DepartmentMeta): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.created = new Date();

  const ws = wb.addWorksheet('기록물 반출입대장', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 6 },  // 연번
    { width: 14 }, // 등록번호
    { width: 34 }, // 기록물(철) 제목
    { width: 9 },  // 생산년도
    { width: 9 },  // 보존기간
    { width: 12 }, // 반출일자
    { width: 22 }, // 반출목적 및 사유
    { width: 16 }, // 반출자 (소속/성명)
    { width: 12 }, // 반입예정일
    { width: 12 }, // 반입일자
    { width: 14 }, // 확인자 서명
    { width: 14 }, // 비고
  ];

  // 제목 행
  ws.addRow([]);
  ws.mergeCells('A2:L2');
  const titleCell = ws.getCell('A2');
  titleCell.value = '기 록 물   반 출 · 반 입   대 장';
  titleCell.font = fontTitle;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 36;

  ws.mergeCells('A3:L3');
  const schoolSub = ws.getCell('A3');
  schoolSub.value = `기관명: ${meta.school_name || '전북특별자치도교육청 오봉초등학교'}    관리부서: ${meta.department || '행정실/교무실'}    기준일: ${meta.base_date || new Date().toISOString().split('T')[0]}`;
  schoolSub.font = fontSubtitle;
  schoolSub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(3).height = 22;

  ws.addRow([]);

  // 테이블 헤더
  const headers = [
    '연번',
    '등록번호',
    '기록물(철) 제목',
    '생산년도',
    '보존기간',
    '반출일자',
    '반출목적 및 사유',
    '반출자(소속/성명)',
    '반입예정일',
    '반입일자',
    '확인자(서명)',
    '비고',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = fillHeaderBlue;
    cell.font = fontHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderMedium;
  });

  // 샘플 및 빈 작성 행 20줄 생성
  const sampleRows = [
    ['1', '2024-교무-001', '2024학년도 학교운영위원회 회의록', '2024', '10년', '2026-09-10', '교육지원청 종합감사 수검 자료 열람', '교무실 / 교사 홍길동', '2026-09-15', '2026-09-14', '서동혁 (인)', '정상 반입 완료'],
    ['2', '2023-행정-042', '2023회계연도 세입세출 결산서철', '2023', '5년', '2026-09-11', '예산 심의 참고용 사본 대조', '행정실 / 주무관 김철수', '2026-09-12', '', '', '대여 중'],
  ];

  sampleRows.forEach((rVals) => {
    const r = ws.addRow(rVals);
    r.height = 24;
    r.eachCell((c, cIdx) => {
      c.font = fontBody;
      c.border = borderThin;
      c.alignment = {
        horizontal: cIdx === 3 || cIdx === 7 ? 'left' : 'center',
        vertical: 'middle',
      };
    });
  });

  // 빈 행 18줄 추가 (출력 후 수기 작성 또는 엑셀 직접 기입 가능)
  for (let i = 3; i <= 20; i++) {
    const emptyVals = [String(i), '', '', '', '', '', '', '', '', '', '', ''];
    const r = ws.addRow(emptyVals);
    r.height = 23;
    r.eachCell((c, cIdx) => {
      c.font = fontBody;
      c.border = borderThin;
      c.alignment = {
        horizontal: cIdx === 3 || cIdx === 7 ? 'left' : 'center',
        vertical: 'middle',
      };
    });
  }

  // 하단 법적 규정 안내
  ws.addRow([]);
  const noticeRow = ws.addRow([
    '※ 공공기록물 관리에 관한 법률 시행규칙 제16조: 보존 중인 기록물은 원칙적으로 보존서고 밖으로 반출할 수 없으나, 업무상 불가피하게 반출하는 때에는 반드시 반출입대장에 기록하고 승인을 받아야 함.',
  ]);
  ws.mergeCells(`A${noticeRow.number}:L${noticeRow.number}`);
  noticeRow.height = 24;
  const nCell = noticeRow.getCell(1);
  nCell.font = fontNotice;
  nCell.alignment = { horizontal: 'left', vertical: 'middle' };

  await downloadWorkbook(wb, `기록물_반출입대장_${meta.school_name || '학교'}.xlsx`);
}

/**
 * 3. 비전자기록물 이관계획서
 * 근거: 공공기록물 관리에 관한 법률 시행령 제40조, 제41조
 */
export async function generateRecordsTransferPlanForm(meta: DepartmentMeta): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.created = new Date();

  // Sheet 1: 총괄 계획서
  const wsPlan = wb.addWorksheet('이관계획서(총괄)', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });

  wsPlan.columns = [
    { width: 14 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
  ];

  wsPlan.addRow([]);
  wsPlan.mergeCells('A2:F2');
  const tCell = wsPlan.getCell('A2');
  tCell.value = '비전자기록물 기록관 이관 계획서';
  tCell.font = fontTitle;
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPlan.getRow(2).height = 36;

  wsPlan.mergeCells('A3:F3');
  const subCell = wsPlan.getCell('A3');
  subCell.value = `이관기관: ${meta.school_name || '오봉초등학교'}    인수기관: 전북특별자치도교육청 기록관`;
  subCell.font = fontSubtitle;
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPlan.getRow(3).height = 22;

  wsPlan.addRow([]);

  // 계획 개요 표
  const planOverview = [
    ['1. 이관 목적', '보존기간 준영구 이상 비전자기록물의 기록관 안전 이관 및 보존환경 확보'],
    ['2. 법적 근거', '「공공기록물 관리에 관한 법률 시행령」 제40조(기록관 등으로의 기록물 이관)'],
    ['3. 이관 대상', '생산 후 10년이 경과한 영구·준영구·30년 보존 비전자기록물철'],
    ['4. 이관 일자', `${meta.base_date || '2026-09-10'} (협의 후 최종 확정)`],
    ['5. 이관 장소', '전북특별자치도교육청 기록관 (지정 보존서고)'],
    ['6. 이관 수량(예정)', '총 00개 보존상자 (약 000권/철)'],
    ['7. 수송 및 인계', '학교 담당자 입회 하에 전용 운반차량으로 봉인 이송'],
    ['8. 소요 예산', '자체 예산 (기록물 보존상자 및 라벨 편철비 등)'],
  ];

  planOverview.forEach((item) => {
    const row = wsPlan.addRow([item[0], item[1], '', '', '', '']);
    row.height = 26;
    const rIdx = row.number;
    wsPlan.mergeCells(`B${rIdx}:F${rIdx}`);
    const c1 = row.getCell(1);
    c1.fill = fillHeaderSlate;
    c1.font = fontHeader;
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    c1.border = borderThin;

    const c2 = row.getCell(2);
    c2.font = fontBody;
    c2.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    c2.border = borderThin;
    [3, 4, 5, 6].forEach((col) => (row.getCell(col).border = borderThin));
  });

  wsPlan.addRow([]);

  // 보존기간별 이관 예정 수량 표
  wsPlan.mergeCells(`A${wsPlan.rowCount + 1}:F${wsPlan.rowCount + 1}`);
  const statTitle = wsPlan.addRow(['■ 보존기간별 이관 대상 수량 집계 (예정)']);
  statTitle.getCell(1).font = fontHeader;

  const statHeaderRow = wsPlan.addRow(['구분', '영구', '준영구', '30년', '기타', '합계']);
  statHeaderRow.height = 26;
  statHeaderRow.eachCell((c) => {
    c.fill = fillHeaderBlue;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderMedium;
  });

  const statValRow1 = wsPlan.addRow(['철 수(권)', '0', '0', '0', '0', '0']);
  statValRow1.height = 24;
  statValRow1.eachCell((c) => {
    c.font = fontBody;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  const statValRow2 = wsPlan.addRow(['상자 수(Box)', '0', '0', '0', '0', '0']);
  statValRow2.height = 24;
  statValRow2.eachCell((c) => {
    c.font = fontBody;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  // Sheet 2: 세부 이관목록 양식
  const wsList = wb.addWorksheet('이관대상목록(서식)', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });
  wsList.columns = [
    { width: 6 },  // 연번
    { width: 16 }, // 등록번호
    { width: 10 }, // 생산년도
    { width: 10 }, // 보존기간
    { width: 38 }, // 기록물철 제목
    { width: 12 }, // 상자번호
    { width: 10 }, // 권차
    { width: 14 }, // 기록물 형태
    { width: 16 }, // 비고
  ];

  wsList.addRow([]);
  wsList.mergeCells('A2:I2');
  const tList = wsList.getCell('A2');
  tList.value = `[비전자기록물 이관 대상 세부 목록] (${meta.school_name || '오봉초등학교'})`;
  tList.font = fontSubtitle;
  tList.alignment = { horizontal: 'left', vertical: 'middle' };
  wsList.getRow(2).height = 26;

  const listHeaders = ['연번', '기록물 고유번호', '생산년도', '보존기간', '기록물철 제목', '상자번호', '권차', '기록물 형태', '비고'];
  const lHeaderRow = wsList.addRow(listHeaders);
  lHeaderRow.height = 28;
  lHeaderRow.eachCell((c) => {
    c.fill = fillHeaderBlue;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderMedium;
  });

  for (let i = 1; i <= 25; i++) {
    const row = wsList.addRow([String(i), '', '', '', '', '', '', '일반문서', '']);
    row.height = 23;
    row.eachCell((c, colIdx) => {
      c.font = fontBody;
      c.border = borderThin;
      c.alignment = {
        horizontal: colIdx === 5 ? 'left' : 'center',
        vertical: 'middle',
      };
    });
  }

  await downloadWorkbook(wb, `비전자기록물_이관계획서_${meta.school_name || '학교'}.xlsx`);
}

/**
 * 4. 비전자기록물 인계·인수서
 * 근거: 공공기록물 관리에 관한 법률 시행규칙 [별지 제17호 서식]
 */
export async function generateRecordsHandoverForm(meta: DepartmentMeta): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '학교 기록물 관리 시스템';
  wb.created = new Date();

  // Sheet 1: 인계인수서 표지
  const wsCover = wb.addWorksheet('인계인수서(표지)', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });

  wsCover.columns = [
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
  ];

  wsCover.addRow([]);
  wsCover.mergeCells('A2:F2');
  const tCell = wsCover.getCell('A2');
  tCell.value = '비 전 자 기 록 물   인 계 · 인 수 서';
  tCell.font = fontTitle;
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsCover.getRow(2).height = 40;

  wsCover.mergeCells('A3:F3');
  const ruleCell = wsCover.getCell('A3');
  ruleCell.value = '【공공기록물 관리에 관한 법률 시행규칙 [별지 제17호 서식]】';
  ruleCell.font = { ...fontNotice, bold: true, color: { argb: 'FF475569' } };
  ruleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsCover.getRow(3).height = 20;

  wsCover.addRow([]);

  // 인계/인수 기관 정보
  const schoolName = meta.school_name || '오봉초등학교';
  const deptName = meta.department || '행정실';
  const handoverDate = meta.base_date || new Date().toISOString().split('T')[0];

  const orgRows = [
    ['인 계 기 관', `${schoolName} (${deptName})`, '인 수 기 관', '전북특별자치도교육청 기록관'],
    ['인계인수일자', handoverDate, '이 관 장 소', '도교육청 기록관 보존서고'],
  ];

  orgRows.forEach((rVals) => {
    const row = wsCover.addRow([rVals[0], rVals[1], '', rVals[2], rVals[3], '']);
    row.height = 26;
    const rIdx = row.number;
    wsCover.mergeCells(`B${rIdx}:C${rIdx}`);
    wsCover.mergeCells(`E${rIdx}:F${rIdx}`);

    [1, 4].forEach((col) => {
      const c = row.getCell(col);
      c.fill = fillHeaderSlate;
      c.font = fontHeader;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = borderThin;
    });

    [2, 3, 5, 6].forEach((col) => {
      const c = row.getCell(col);
      c.font = fontBody;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = borderThin;
    });
  });

  wsCover.addRow([]);

  // 인계인수 수량 총괄표
  const totalRow = wsCover.addRow(['■ 인계·인수 기록물 수량 총괄']);
  wsCover.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
  totalRow.getCell(1).font = fontHeader;

  const countHeaders = ['구 분', '영구', '준영구', '30년', '기타', '계'];
  const cHRow = wsCover.addRow(countHeaders);
  cHRow.height = 26;
  cHRow.eachCell((c) => {
    c.fill = fillHeaderBlue;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderMedium;
  });

  const cValRow1 = wsCover.addRow(['기록물철 수(권)', '0', '0', '0', '0', '0']);
  cValRow1.height = 24;
  cValRow1.eachCell((c) => {
    c.font = fontBody;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  const cValRow2 = wsCover.addRow(['보존상자 수(Box)', '0', '0', '0', '0', '0']);
  cValRow2.height = 24;
  cValRow2.eachCell((c) => {
    c.font = fontBody;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  wsCover.addRow([]);

  // 확약 문구
  const pledgeRow = wsCover.addRow([
    '「공공기록물 관리에 관한 법률 시행령」 제40조 및 제41조에 따라 위와 같이 비전자기록물을 정히 인계·인수합니다.',
  ]);
  wsCover.mergeCells(`A${pledgeRow.number}:F${pledgeRow.number}`);
  pledgeRow.height = 36;
  const pCell = pledgeRow.getCell(1);
  pCell.font = { ...fontSubtitle, size: 10.5 };
  pCell.alignment = { horizontal: 'center', vertical: 'middle' };

  wsCover.addRow([]);

  // 3자 서명 날인란 (인계자, 인수자, 입회자)
  const signTableH = wsCover.addRow(['구 분', '소속 기관 및 부서', '직급 / 직위', '성명', '서명 / 날인', '']);
  signTableH.height = 24;
  wsCover.mergeCells(`E${signTableH.number}:F${signTableH.number}`);
  signTableH.eachCell((c) => {
    c.fill = fillHeaderSlate;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderThin;
  });

  const signs = [
    ['인 계 자', `${schoolName} ${deptName}`, '행정주사 / 주무관', meta.manager_name || '서동혁', '(서명/인)'],
    ['인 수 자', '전북특별자치도교육청 기록관', '기록연구사', '이영희', '(서명/인)'],
    ['입 회 자', `${schoolName} 학교장`, '교장', '김교장', '(서명/인)'],
  ];

  signs.forEach((s) => {
    const sRow = wsCover.addRow([s[0], s[1], s[2], s[3], s[4], '']);
    sRow.height = 32;
    wsCover.mergeCells(`E${sRow.number}:F${sRow.number}`);
    sRow.eachCell((c) => {
      c.font = fontBody;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = borderThin;
    });
  });

  // Sheet 2: 세부 목록
  const wsDetail = wb.addWorksheet('인계인수목록', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 },
  });
  wsDetail.columns = [
    { width: 6 },  // 연번
    { width: 16 }, // 고유번호
    { width: 10 }, // 생산년도
    { width: 10 }, // 보존기간
    { width: 40 }, // 기록물철 제목
    { width: 10 }, // 권차
    { width: 12 }, // 상자번호
    { width: 14 }, // 상태 점검
    { width: 16 }, // 비고
  ];

  wsDetail.addRow([]);
  wsDetail.mergeCells('A2:I2');
  const dTitle = wsDetail.getCell('A2');
  dTitle.value = `[비전자기록물 인계·인수 세부 목록] (${schoolName})`;
  dTitle.font = fontSubtitle;
  dTitle.alignment = { horizontal: 'left', vertical: 'middle' };
  wsDetail.getRow(2).height = 26;

  const detailHeaders = ['연번', '기록물 고유번호', '생산년도', '보존기간', '기록물철 제목', '권차', '상자번호', '상태점검', '비고'];
  const dHRow = wsDetail.addRow(detailHeaders);
  dHRow.height = 28;
  dHRow.eachCell((c) => {
    c.fill = fillHeaderBlue;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderMedium;
  });

  for (let i = 1; i <= 25; i++) {
    const row = wsDetail.addRow([String(i), '', '', '', '', '1/1', '', '양호', '']);
    row.height = 23;
    row.eachCell((c, colIdx) => {
      c.font = fontBody;
      c.border = borderThin;
      c.alignment = {
        horizontal: colIdx === 5 ? 'left' : 'center',
        vertical: 'middle',
      };
    });
  }

  await downloadWorkbook(wb, `비전자기록물_인계인수서_${schoolName}.xlsx`);
}
