import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/forms');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const fontTitle = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF0F172A' } };
const fontHeader = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E293B' } };
const fontBody = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF334155' } };
const borderThin = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } },
};
const fillBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
const fillSlate = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

// 1. 기록물관리책임자 지정통보서
async function makeManagerForm() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('기록물관리책임자 지정통보서');
  ws.columns = [{ width: 14 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 22 }, { width: 20 }];
  ws.addRow([]);
  ws.mergeCells('A2:F2');
  const t = ws.getCell('A2');
  t.value = '기록물관리책임자 지정(변경) 통보서';
  t.font = fontTitle;
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 36;

  ws.mergeCells('A3:F3');
  const law = ws.getCell('A3');
  law.value = '【관련 근거: 「공공기록물 관리에 관한 법률 시행령」 제12조】';
  law.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FF475569' } };
  law.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.addRow([]);
  const r1 = ws.addRow(['기 관 명', '오봉초등학교', '', '처 리 과', '교무실/행정실', '']);
  ws.mergeCells(`B${r1.number}:C${r1.number}`);
  ws.mergeCells(`E${r1.number}:F${r1.number}`);
  [1, 4].forEach((c) => { r1.getCell(c).fill = fillSlate; r1.getCell(c).font = fontHeader; r1.getCell(c).border = borderThin; });
  [2, 3, 5, 6].forEach((c) => { r1.getCell(c).font = fontBody; r1.getCell(c).border = borderThin; });

  const h = ws.addRow(['구분', '소속 부서', '직급 / 직위', '성명', '담당 기록관리 업무', '비고']);
  h.height = 26;
  h.eachCell((c) => { c.fill = fillBlue; c.font = fontHeader; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = borderThin; });

  const rows = [
    ['정(책임자)', '행정실/교무실', '행정주사 / 주무관', '서동혁', '기록물 총괄 편철 및 이관', '063-000-0000'],
    ['부(담당자)', '행정실/교무실', '교사 / 실무사', '홍길동', '기록물 편철 보조 및 등록', '063-000-0000'],
  ];
  rows.forEach((rVals) => {
    const row = ws.addRow(rVals);
    row.height = 24;
    row.eachCell((c, i) => {
      c.font = fontBody;
      c.border = borderThin;
      c.alignment = { horizontal: i === 1 || i === 3 || i === 4 ? 'center' : 'left', vertical: 'middle' };
    });
  });

  await wb.xlsx.writeFile(path.join(outDir, '기록물관리_책임자_지정통보서.xlsx'));
}

// 2. 기록물 반출입대장
async function makeInOutLog() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('기록물 반출입대장');
  ws.columns = [
    { width: 6 }, { width: 14 }, { width: 34 }, { width: 9 }, { width: 9 }, { width: 12 },
    { width: 22 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 },
  ];
  ws.addRow([]);
  ws.mergeCells('A2:L2');
  const t = ws.getCell('A2');
  t.value = '기 록 물   반 출 · 반 입   대 장';
  t.font = fontTitle;
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 36;

  const h = ws.addRow([
    '연번', '등록번호', '기록물(철) 제목', '생산년도', '보존기간', '반출일자',
    '반출목적 및 사유', '반출자(소속/성명)', '반입예정일', '반입일자', '확인자(서명)', '비고',
  ]);
  h.height = 26;
  h.eachCell((c) => { c.fill = fillBlue; c.font = fontHeader; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = borderThin; });

  for (let i = 1; i <= 25; i++) {
    const r = ws.addRow([String(i), '', '', '', '', '', '', '', '', '', '', '']);
    r.height = 23;
    r.eachCell((c) => { c.font = fontBody; c.border = borderThin; });
  }

  await wb.xlsx.writeFile(path.join(outDir, '기록물_반출입대장.xlsx'));
}

// 3. 비전자기록물 이관계획서
async function makeTransferPlan() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('이관계획서(총괄)');
  ws.columns = [{ width: 16 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 }];
  ws.addRow([]);
  ws.mergeCells('A2:F2');
  const t = ws.getCell('A2');
  t.value = '비전자기록물 기록관 이관 계획서';
  t.font = fontTitle;
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 36;

  const items = [
    ['1. 이관 목적', '보존기간 준영구 이상 비전자기록물의 기록관 안전 이관 및 보존환경 확보'],
    ['2. 법적 근거', '「공공기록물 관리에 관한 법률 시행령」 제40조(기록관 등으로의 기록물 이관)'],
    ['3. 이관 대상', '생산 후 10년이 경과한 영구·준영구·30년 보존 비전자기록물철'],
    ['4. 이관 일자', '2026-09-10 (협의 후 최종 확정)'],
    ['5. 이관 장소', '전북특별자치도교육청 기록관 (지정 보존서고)'],
  ];
  items.forEach((item) => {
    const row = ws.addRow([item[0], item[1], '', '', '', '']);
    row.height = 25;
    ws.mergeCells(`B${row.number}:F${row.number}`);
    row.getCell(1).fill = fillSlate;
    row.getCell(1).font = fontHeader;
    row.getCell(1).border = borderThin;
    row.getCell(2).font = fontBody;
    row.getCell(2).border = borderThin;
    [3, 4, 5, 6].forEach((c) => (row.getCell(c).border = borderThin));
  });

  const wsList = wb.addWorksheet('이관대상목록(서식)');
  wsList.columns = [{ width: 6 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 38 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 16 }];
  const lh = wsList.addRow(['연번', '기록물 고유번호', '생산년도', '보존기간', '기록물철 제목', '상자번호', '권차', '기록물 형태', '비고']);
  lh.height = 26;
  lh.eachCell((c) => { c.fill = fillBlue; c.font = fontHeader; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = borderThin; });
  for (let i = 1; i <= 25; i++) {
    const r = wsList.addRow([String(i), '', '', '', '', '', '', '일반문서', '']);
    r.height = 23;
    r.eachCell((c) => { c.font = fontBody; c.border = borderThin; });
  }

  await wb.xlsx.writeFile(path.join(outDir, '비전자기록물_이관계획서.xlsx'));
}

// 4. 비전자기록물 인계인수서
async function makeHandover() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('인계인수서(표지)');
  ws.columns = [{ width: 14 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }];
  ws.addRow([]);
  ws.mergeCells('A2:F2');
  const t = ws.getCell('A2');
  t.value = '비 전 자 기 록 물   인 계 · 인 수 서';
  t.font = fontTitle;
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 40;

  const orgs = [
    ['인 계 기 관', '오봉초등학교', '인 수 기 관', '전북특별자치도교육청 기록관'],
    ['인계인수일자', '2026-09-10', '이 관 장 소', '도교육청 기록관 보존서고'],
  ];
  orgs.forEach((rVals) => {
    const row = ws.addRow([rVals[0], rVals[1], '', rVals[2], rVals[3], '']);
    row.height = 26;
    ws.mergeCells(`B${row.number}:C${row.number}`);
    ws.mergeCells(`E${row.number}:F${row.number}`);
    [1, 4].forEach((col) => {
      row.getCell(col).fill = fillSlate;
      row.getCell(col).font = fontHeader;
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(col).border = borderThin;
    });
    [2, 3, 5, 6].forEach((col) => {
      row.getCell(col).font = fontBody;
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(col).border = borderThin;
    });
  });

  const wsList = wb.addWorksheet('인계인수목록');
  wsList.columns = [{ width: 6 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 40 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 16 }];
  const lh = wsList.addRow(['연번', '기록물 고유번호', '생산년도', '보존기간', '기록물철 제목', '권차', '상자번호', '상태점검', '비고']);
  lh.height = 26;
  lh.eachCell((c) => { c.fill = fillBlue; c.font = fontHeader; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = borderThin; });
  for (let i = 1; i <= 25; i++) {
    const r = wsList.addRow([String(i), '', '', '', '', '1/1', '', '양호', '']);
    r.height = 23;
    r.eachCell((c) => { c.font = fontBody; c.border = borderThin; });
  }

  await wb.xlsx.writeFile(path.join(outDir, '비전자기록물_인계인수서.xlsx'));
}

async function main() {
  await makeManagerForm();
  await makeInOutLog();
  await makeTransferPlan();
  await makeHandover();
  console.log('Successfully generated static form files in public/forms/');
}

main().catch(console.error);
