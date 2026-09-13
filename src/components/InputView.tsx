import React, { useState, useRef, useEffect } from 'react';
import {
  RecordItem,
  RecordType,
  RetentionPeriod,
  RETENTION_PERIODS,
  TaskCard,
  RecommendationResult,
  DepartmentMeta,
} from '../types';
import {
  Plus,
  Trash2,
  CheckSquare,
  Sparkles,
  Info,
  CheckCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Download,
  Upload,
  Bot,
  Loader2,
  FileSearch,
} from 'lucide-react';
import {
  calculateExpiryYear,
  generateRecordId,
  generateRecordNo,
  recommendBoxNo,
  getExistingBoxNumbers,
} from '../utils/recordUtils';
import {
  downloadBatchInputExcelTemplate,
  parseBatchInputExcelFile,
} from '../utils/excelUtils';
import { AIRecommendModal } from './AIRecommendModal';
import { recommendTaskCards, batchRecommend } from '../utils/similarityUtils';

interface InputViewProps {
  records: RecordItem[];
  taskCards: TaskCard[];
  meta: DepartmentMeta;
  onAddRecords: (newRecords: RecordItem[]) => void;
  onUpdateRecord: (updatedRecord: RecordItem) => void;
  onDeleteRecords: (recordIds: string[]) => void;
  onCompleteRecords: (recordIds: string[]) => void;
  onSelectPeriodMenu: (period: RetentionPeriod) => void;
}

interface DraftRow {
  localId: string;
  record_id?: string;
  record_type: RecordType;
  start_year: number;
  end_year: number;
  retention_period: RetentionPeriod;
  title: string;
  production_school?: string; // 생산부서(학교)
  is_custom_dept?: boolean;   // 생산부서가 처리과와 다른 예외 체크
  box_no: string;
  shelf_no: string;
  isExistingDraft?: boolean;
}

export const InputView: React.FC<InputViewProps> = ({
  records,
  taskCards,
  meta,
  onAddRecords,
  onUpdateRecord,
  onDeleteRecords,
  onCompleteRecords,
  onSelectPeriodMenu,
}) => {
  const currentYear = new Date().getFullYear();

  // 이미 존재하는 임시 기록물 (is_completed: false & !is_disposed)
  const existingDrafts = records.filter((r) => !r.is_completed && !r.is_disposed);

  // 로컬 편집용 행 목록 (기존 임시 기록물 + 새로 추가된 행)
  const [draftRows, setDraftRows] = useState<DraftRow[]>(() => {
    if (existingDrafts.length > 0) {
      return existingDrafts.map((d) => {
        const isCustom = Boolean(
          d.production_school &&
          d.production_school.trim() !== '' &&
          d.production_school.trim() !== (meta.department || '').trim()
        );
        return {
          localId: d.record_id,
          record_id: d.record_id,
          record_type: d.record_type,
          start_year: d.start_year,
          end_year: d.end_year,
          retention_period: d.retention_period,
          title: d.title,
          production_school: d.production_school || '',
          is_custom_dept: isCustom,
          box_no: d.box_no,
          shelf_no: d.shelf_no,
          isExistingDraft: true,
        };
      });
    }
    // 기본 대기 목록 0개로 초기화
    return [];
  });

  const [selectedLocalIds, setSelectedLocalIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 각 행의 기록물철제목 input 요소를 가리키는 ref 맵
  const titleInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  // 각 행의 유형(record_type) select 요소를 가리키는 ref 맵 (엔터 시 다음 행 [유형] 자동 포커스용)
  const typeSelectRefs = useRef<Map<string, HTMLSelectElement>>(new Map());

  // 과제카드 유사도 추천 모달 상태 (단건 추천)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeAnalyzingRowId, setActiveAnalyzingRowId] = useState<string | null>(null);
  const [activeAnalyzingTitle, setActiveAnalyzingTitle] = useState('');
  const [aiResult, setAiResult] = useState<RecommendationResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // AI 일괄 추천 상태
  const [isBatchAILoading, setIsBatchAILoading] = useState(false);
  const [batchAIMessage, setBatchAIMessage] = useState<string | null>(null);

  // 엑셀 업로드 안내 배너
  const [excelImportNotice, setExcelImportNotice] = useState<string | null>(null);

  // 완료 안내 메시지 배너
  const [completionNotice, setCompletionNotice] = useState<{
    count: number;
    periodGroups: Record<string, number>;
  } | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLocalIds(new Set(draftRows.map((r) => r.localId)));
    } else {
      setSelectedLocalIds(new Set());
    }
  };

  const toggleSelectRow = (localId: string) => {
    const next = new Set(selectedLocalIds);
    if (next.has(localId)) {
      next.delete(localId);
    } else {
      next.add(localId);
    }
    setSelectedLocalIds(next);
  };

  const handleRowChange = (localId: string, field: keyof DraftRow, value: any) => {
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row;
        const updated = { ...row, [field]: value };
        // 생산년도가 종료년도보다 크면 종료년도 자동 맞춤
        if (field === 'start_year' && updated.start_year > updated.end_year) {
          updated.end_year = updated.start_year;
        }
        // 보존기간 변경 시, 기존에 상자번호가 입력되어 있던 경우에만 새 보존기간에 맞춰 연동 갱신 (공백인 경우 공백 유지)
        if (field === 'retention_period') {
          const newPeriod = value as RetentionPeriod;
          if (updated.box_no && updated.box_no.trim() !== '') {
            updated.box_no = recommendBoxNo(newPeriod, updated.end_year, records);
          }
        }
        // 종료년도 변경 시, 기존에 상자번호가 입력되어 있던 경우에만 연동 갱신 (공백인 경우 공백 유지)
        if (field === 'end_year') {
          const newEndYear = Number(value);
          if (updated.box_no && updated.box_no.trim() !== '' && updated.box_no.startsWith(`${updated.retention_period}-`)) {
            updated.box_no = recommendBoxNo(updated.retention_period, newEndYear, records);
          }
        }
        return updated;
      })
    );
  };

  const handleAddRow = (insertAfterIndex?: number) => {
    const defaultPeriod: RetentionPeriod = '5년';
    const newId = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newRow: DraftRow = {
      localId: newId,
      record_type: '일반',
      start_year: currentYear,
      end_year: currentYear,
      retention_period: defaultPeriod,
      title: '',
      production_school: '',
      is_custom_dept: false,
      box_no: '',
      shelf_no: '',
    };

    setDraftRows((prev) => {
      if (insertAfterIndex !== undefined && insertAfterIndex >= 0 && insertAfterIndex < prev.length) {
        const next = [...prev];
        next.splice(insertAfterIndex + 1, 0, newRow);
        return next;
      }
      return [...prev, newRow];
    });

    // 새로 추가된 행의 [유형] 선택란으로 키보드 커서(포커스) 자동 이동 (요구사항 1, 5)
    setTimeout(() => {
      const select = typeSelectRefs.current.get(newId);
      if (select) {
        select.focus();
        select.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 40);

    return newId;
  };

  // 각 행의 입력 필드 및 선택 박스에서 엔터(Enter)를 누르면 다음 행이 추가되고 다음 행의 [유형]으로 커서 이동 (요구사항 1)
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    currentIndex: number
  ) => {
    // 한글 조합(IME) 중 발생하는 엔터 키 이벤트는 중복 방지를 위해 무시
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter') {
      e.preventDefault();

      // 마지막 행이면 무조건 새 행 추가 후 새 행의 [유형]으로 커서 이동
      if (currentIndex === draftRows.length - 1) {
        handleAddRow();
      } else {
        // 다음 행이 있는 경우 다음 행의 [유형]으로 포커스 이동
        const nextRow = draftRows[currentIndex + 1];
        if (nextRow) {
          const nextSelect = typeSelectRefs.current.get(nextRow.localId);
          if (nextSelect) {
            nextSelect.focus();
            nextSelect.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            handleAddRow(currentIndex);
          }
        } else {
          handleAddRow(currentIndex);
        }
      }
    }
  };

  // 입력 대기 목록이 아예 비어있는 경우에도 엔터(Enter)를 누르면 행 추가하기가 되고 [유형]에 커서가 이동 (요구사항 5)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (draftRows.length === 0 && e.key === 'Enter' && !e.isComposing) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        // 사용자가 다른 텍스트 입력창이나 모달 내부에서 작업 중이 아닌 경우에만 실행
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          handleAddRow();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [draftRows.length]);

  // 요구사항 3: 엑셀 서식 다운로드
  const handleDownloadExcelTemplate = async () => {
    try {
      await downloadBatchInputExcelTemplate(meta);
    } catch (err) {
      alert('엑셀 서식 다운로드 중 오류가 발생했습니다: ' + String(err));
    }
  };

  // 요구사항 4, 5: 엑셀 파일 업로드 및 입력 대기 목록 추가 (사용자 엑셀 상자번호 100% 보존)
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedRecords = await parseBatchInputExcelFile(file);
      if (parsedRecords.length === 0) {
        alert('업로드된 엑셀 파일에서 유효한 기록물 데이터를 찾을 수 없습니다.');
        return;
      }

      const defaultDept = (meta.department || '').trim();

      const newDrafts: DraftRow[] = parsedRecords.map((item, idx) => {
        const period: RetentionPeriod = item.retention_period || '5년';
        const boxNo = item.box_no !== undefined ? String(item.box_no).trim() : '';
        const shelfNo = item.shelf_no !== undefined ? String(item.shelf_no).trim() : '';
        const prodSchool = item.production_school !== undefined ? String(item.production_school).trim() : '';
        const isCustom = Boolean(prodSchool && prodSchool !== '' && prodSchool !== defaultDept);

        return {
          localId: `excel-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          record_type: item.record_type,
          start_year: item.start_year,
          end_year: item.end_year,
          retention_period: period,
          title: item.title,
          production_school: prodSchool,
          is_custom_dept: isCustom,
          box_no: boxNo,
          shelf_no: shelfNo,
        };
      });

      // 업로드된 새 행에 대해 로컬 과제카드 유사도 기준 보존기간 추천 (엑셀에 입력된 상자번호는 무조건 그대로 보존)
      try {
        const uploadItems = newDrafts.map((r) => ({ id: r.localId, title: r.title.trim() }));
        const resultMap = batchRecommend(uploadItems, taskCards);
        newDrafts.forEach((row, i) => {
          if (resultMap.has(row.localId)) {
            const rec = resultMap.get(row.localId)!;
            // 엑셀 파일에 보존기간이 명시되지 않은 경우에만 추천 보존기간 적용
            if (!parsedRecords[i]?.retention_period) {
              row.retention_period = rec.period;
            }
            // 엑셀의 상자번호는 절대 변경하지 않고 원본 그대로 유지
          }
        });
      } catch (recErr) {
        console.warn('Local recommendation on upload skipped:', recErr);
      }

      

      // 기존 작성 중이던 빈 행만 있는 상태라면 교체, 데이터가 있으면 뒤에 추가
      const isBlankDefault =
        draftRows.length === 0 || draftRows.every((r) => !r.title.trim() && !r.isExistingDraft);

      const mergedRows = isBlankDefault ? newDrafts : [...draftRows, ...newDrafts];
      setDraftRows(mergedRows);
      // 업로드된 새 행들을 모두 선택 처리
      setSelectedLocalIds(new Set(newDrafts.map((r) => r.localId)));
      setExcelImportNotice(
        `Excel 파일에서 ${newDrafts.length}건의 기록물을 입력 대기 목록으로 성공적으로 가져왔으며, 엑셀 파일에 입력된 상자번호가 그대로 반영되었습니다.`
      );
      setBatchAIMessage(null);
    } catch (err) {
      console.error('Excel upload error:', err);
      alert('Excel 파일 분석 중 오류가 발생했습니다: ' + String(err));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 유사 과제카드 보존기간 일괄추천 (로컬 문자열 유사도 알고리즘)
  const handleBatchAIRecommend = async () => {
    const targetRows =
      selectedLocalIds.size > 0
        ? draftRows.filter((r) => selectedLocalIds.has(r.localId) && r.title.trim())
        : draftRows.filter((r) => r.title.trim());

    if (targetRows.length === 0) {
      alert(
        '과제카드 보존기간 일괄 추천을 수행할 기록물철제목이 입력된 행이 없습니다.\n먼저 기록물철제목을 입력하거나 엑셀 파일을 업로드해주세요.'
      );
      return;
    }

    setIsBatchAILoading(true);
    setBatchAIMessage(null);

    try {
      const items = targetRows.map((r) => ({ id: r.localId, title: r.title.trim() }));
      const resultMap = batchRecommend(items, taskCards);

      // 입력대기목록 일괄 반영
      setDraftRows((prev) =>
        prev.map((row) => {
          const rec = resultMap.get(row.localId);
          if (!rec) return row;
          const newPeriod = rec.period;
          // 상자번호가 기존에 입력되어 있던 경우에만 새 보존기간에 맞춰 연동 갱신, 비어있던 경우 빈 값 그대로 보존
          const newBoxNo =
            row.box_no && row.box_no.trim() !== ''
              ? recommendBoxNo(newPeriod, row.end_year, records)
              : '';
          return {
            ...row,
            retention_period: newPeriod,
            box_no: newBoxNo,
          };
        })
      );

      setBatchAIMessage(
        `로컬 유사도 분석 알고리즘을 통해 총 ${targetRows.length}건의 기록물에 대해 등록된 과제카드 기준과 비교하여 보존기간을 일괄 추천·적용하였습니다. (※ 과제카드명과의 유사도를 기준으로 산출한 참고용 추천 결과입니다.)`
      );
    } catch (err) {
      console.warn('Batch recommendation error:', err);
      alert('일괄 추천 중 오류가 발생했습니다: ' + String(err));
    } finally {
      setIsBatchAILoading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLocalIds.size === 0) {
      return;
    }

    // 서버/상태에 이미 저장된 draft id들
    const existingIdsToDelete: string[] = [];
    draftRows.forEach((r) => {
      if (selectedLocalIds.has(r.localId) && r.record_id) {
        existingIdsToDelete.push(r.record_id);
      }
    });

    if (existingIdsToDelete.length > 0) {
      onDeleteRecords(existingIdsToDelete);
    }

    setDraftRows((prev) => prev.filter((r) => !selectedLocalIds.has(r.localId)));
    setSelectedLocalIds(new Set());
  };

  // 과제카드 유사도 추천 트리거 (로컬 문자열 유사도 엔진)
  const handleTriggerAI = (row: DraftRow) => {
    if (!row.title.trim()) {
      alert('과제카드 추천을 위해 먼저 기록물철제목을 입력해주세요.');
      return;
    }

    setActiveAnalyzingRowId(row.localId);
    setActiveAnalyzingTitle(row.title);
    setAiModalOpen(true);
    setAiLoading(false);

    const result = recommendTaskCards(row.title, taskCards);
    setAiResult(result);
  };

  const handleApplyAIPeriod = (period: RetentionPeriod) => {
    if (activeAnalyzingRowId) {
      handleRowChange(activeAnalyzingRowId, 'retention_period', period);
    }
  };

  // 선택한 행 일괄 입력완료 처리
  const handleCompleteSelected = () => {
    const targetRows = draftRows.filter((r) => selectedLocalIds.has(r.localId));
    if (targetRows.length === 0) {
      alert('입력완료할 행을 선택해주세요.');
      return;
    }

    // 유효성 검사 (제목 필수)
    const emptyTitles = targetRows.filter((r) => !r.title.trim());
    if (emptyTitles.length > 0) {
      alert(`제목이 입력되지 않은 행이 ${emptyTitles.length}건 있습니다. 모든 기록물철제목을 입력해주세요.`);
      return;
    }

    const existingRecordIds = records.map((r) => r.record_id);
    const accumulatedRecords = [...records];
    const newRecordsToAdd: RecordItem[] = [];
    const existingIdsToComplete: string[] = [];

    const periodCounts: Record<string, number> = {};

    const defaultDept = (meta.department || '').trim();

    targetRows.forEach((r) => {
      periodCounts[r.retention_period] = (periodCounts[r.retention_period] || 0) + 1;

      // 보존기간별 고유번호 생성 (예: 5년-000001)
      const recordNo = generateRecordNo(r.retention_period, accumulatedRecords);

      // 생산학교명: 다른 부서 체크 시 직접 입력값, 미체크 시 표지 및 현황의 처리과명 적용
      const finalProdSchool =
        r.is_custom_dept && r.production_school && r.production_school.trim() !== ''
          ? r.production_school.trim()
          : defaultDept;
      // 관리학교명: 기본적으로 표지 및 현황의 처리과명 적용
      const finalMgmtSchool = defaultDept;

      if (r.record_id && r.isExistingDraft) {
        // 이미 생성된 임시 기록물인 경우 -> 내용 업데이트 및 입력완료 처리
        const existingItem = records.find((item) => item.record_id === r.record_id);
        const finalRecordNo = existingItem?.record_no || recordNo;

        const updatedItem: RecordItem = {
          record_id: r.record_id,
          record_no: finalRecordNo,
          production_school: finalProdSchool,
          management_school: finalMgmtSchool,
          record_type: r.record_type,
          start_year: Number(r.start_year),
          end_year: Number(r.end_year),
          retention_period: r.retention_period,
          title: r.title.trim(),
          box_no: (r.box_no || '').trim(),
          shelf_no: (r.shelf_no || '').trim(),
          is_completed: true,
          is_disposed: false,
          disposal_date: null,
          created_at: existingItem?.created_at || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString().split('T')[0],
        };

        onUpdateRecord(updatedItem);
        existingIdsToComplete.push(r.record_id);
        // 누적 목록 갱신
        const idx = accumulatedRecords.findIndex((it) => it.record_id === r.record_id);
        if (idx >= 0) accumulatedRecords[idx] = updatedItem;
        else accumulatedRecords.push(updatedItem);
      } else {
        // 신규 추가 행
        const newId = generateRecordId(existingRecordIds);
        existingRecordIds.push(newId);

        const newItem: RecordItem = {
          record_id: newId,
          record_no: recordNo,
          production_school: finalProdSchool,
          management_school: finalMgmtSchool,
          record_type: r.record_type,
          start_year: Number(r.start_year),
          end_year: Number(r.end_year),
          retention_period: r.retention_period,
          title: r.title.trim(),
          box_no: (r.box_no || '').trim(),
          shelf_no: (r.shelf_no || '').trim(),
          is_completed: true, // 입력완료 즉시 확정
          is_disposed: false,
          disposal_date: null,
          created_at: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString().split('T')[0],
        };

        newRecordsToAdd.push(newItem);
        accumulatedRecords.push(newItem);
      }
    });

    if (newRecordsToAdd.length > 0) {
      onAddRecords(newRecordsToAdd);
    }
    if (existingIdsToComplete.length > 0) {
      onCompleteRecords(existingIdsToComplete);
    }

    // 완료된 행은 입력 화면 목록에서 제거
    setDraftRows((prev) => prev.filter((r) => !selectedLocalIds.has(r.localId)));
    setSelectedLocalIds(new Set());

    // 완료 안내 배너 노출
    setCompletionNotice({
      count: targetRows.length,
      periodGroups: periodCounts,
    });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Hidden File Input for Excel Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls"
        onChange={handleExcelFileChange}
        className="hidden"
      />

      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                기록물 일괄 입력 및 유사 과제카드 추천
              </h2>
              <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">
                입력 대기 목록
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              표준 엑셀 서식을 다운로드하여 대량 작성 후 업로드하거나, 화면에서 직접 행을 추가해 작성할 수 있습니다.
              <br />
              <strong className="text-indigo-700">「유사 과제카드 일괄추천」</strong>을 실행하면 학교 과제카드 기준에 맞춰 최적의 보존기간과 상자번호가 자동 추천되며, 모든 값은 자유롭게 수정 가능합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 입력서식 다운로드 버튼 (요구사항 13) */}
            <button
              id="input-btn-download-template"
              onClick={handleDownloadExcelTemplate}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              title="대량 입력을 위한 표준 입력서식(Excel)을 다운로드합니다."
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>입력서식 다운로드</span>
            </button>

            {/* Excel 업로드 버튼 (요구사항 13) */}
            <button
              id="input-btn-upload-excel"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              title="작성한 Excel 파일을 업로드하여 입력 대기 목록으로 가져옵니다."
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Excel 업로드</span>
            </button>

            {/* 유사 과제카드 보존기간 일괄추천 버튼 */}
            <button
              id="input-btn-batch-ai"
              onClick={handleBatchAIRecommend}
              disabled={isBatchAILoading || draftRows.length === 0}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-800 hover:to-blue-800 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              title="입력 대기 목록의 제목과 과제카드명을 비교하여 보존기간과 상자번호를 일괄 추천합니다."
            >
              {isBatchAILoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>분석 중...</span>
                </>
              ) : (
                <>
                  <FileSearch className="w-3.5 h-3.5 text-blue-200" />
                  <span>유사 과제카드 일괄추천</span>
                </>
              )}
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

            <button
              id="input-btn-add-row"
              onClick={handleAddRow}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              행 추가
            </button>
            <button
              id="input-btn-delete-selected"
              onClick={handleDeleteSelected}
              disabled={selectedLocalIds.size === 0}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              선택 삭제 ({selectedLocalIds.size})
            </button>
            <button
              id="input-btn-complete-selected"
              onClick={handleCompleteSelected}
              disabled={selectedLocalIds.size === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              선택 항목 입력완료 ({selectedLocalIds.size})
            </button>
          </div>
        </div>
      </div>

      {/* 엑셀 업로드 완료 안내 배너 */}
      {excelImportNotice && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3.5 text-blue-900 shadow-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs">
            <FileSpreadsheet className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="font-semibold">{excelImportNotice}</span>
            <span className="text-slate-600">
              ([유사 과제카드 일괄추천] 버튼을 클릭하여 보존기간을 추천받거나 직접 입력하세요)
            </span>
          </div>
          <button
            onClick={() => setExcelImportNotice(null)}
            className="text-blue-700 hover:text-blue-900 text-xs font-semibold cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* 과제카드 일괄 추천 완료 안내 배너 */}
      {batchAIMessage && (
        <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3.5 text-indigo-950 shadow-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs">
            <FileSearch className="w-4 h-4 text-indigo-700 flex-shrink-0" />
            <span className="font-semibold">{batchAIMessage}</span>
          </div>
          <button
            onClick={() => setBatchAIMessage(null)}
            className="text-indigo-700 hover:text-indigo-900 text-xs font-semibold cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* Completion Banner */}
      {completionNotice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 text-emerald-900 shadow-xs flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                총 {completionNotice.count}건의 기록물이 정식 관리 대상으로 [입력완료] 되었습니다!
              </div>
              <div className="text-xs text-emerald-800 mt-1 flex items-center gap-2 flex-wrap">
                <span>보존기간별 자동 이동 현황:</span>
                {Object.entries(completionNotice.periodGroups).map(([period, count]) => (
                  <button
                    key={period}
                    onClick={() => onSelectPeriodMenu(period as RetentionPeriod)}
                    className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100 cursor-pointer text-xs"
                  >
                    <span>{period} ({count}건)</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setCompletionNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* Spreadsheet Input Table */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 font-semibold">
          <div className="flex items-center gap-2 flex-wrap">
            <span>입력 대기 목록 : 총 {draftRows.length}행</span>
            {selectedLocalIds.size > 0 && (
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {selectedLocalIds.size}개 행 선택됨
              </span>
            )}
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 font-normal">
              기본 처리과: <strong className="text-slate-800 font-semibold">{meta.department || '미지정'}</strong> (생산학교·관리학교 자동 적용)
            </span>
          </div>
          <div className="text-slate-600 font-medium flex items-center gap-1">
            <span className="text-blue-600 font-bold">💡 Tip:</span> 각 행을 입력하고 <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded font-mono text-[10px] text-slate-800">Enter</kbd>를 누르면 다음 행이 자동 추가되고 <span className="font-bold text-blue-700">[유형]</span>으로 커서가 이동합니다. (목록이 비어있을 때도 Enter를 누르면 행이 추가됩니다)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-200/90 text-slate-800 font-bold border-b border-slate-300 divide-x divide-slate-300">
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={draftRows.length > 0 && selectedLocalIds.size === draftRows.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-2.5 w-12 text-center">순번</th>
                <th className="p-2.5 w-24 text-center">유형</th>
                <th className="p-2.5 w-20 text-center">생산년도</th>
                <th className="p-2.5 w-20 text-center">종료년도</th>
                <th className="p-2.5 min-w-[260px]">
                  기록물철제목 <span className="text-red-600">*</span>
                </th>
                <th className="p-2.5 min-w-[170px] text-center">
                  <div className="flex flex-col items-center">
                    <span>생산부서(학교)</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      기본: {meta.department || '처리과'}
                    </span>
                  </div>
                </th>
                <th className="p-2.5 w-28 text-center">과제카드 추천</th>
                <th className="p-2.5 w-28 text-center">보존기간</th>
                <th className="p-2.5 w-20 text-center">만료연도</th>
                <th className="p-2.5 w-24 text-center">상자번호</th>
                <th className="p-2.5 w-24 text-center">서가번호</th>
                <th className="p-2.5 w-14 text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {draftRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-500 bg-slate-50">
                    <p className="font-semibold text-slate-700 text-sm mb-1">입력 대기 목록이 비어 있습니다.</p>
                    <p className="text-xs text-slate-500 mb-3">
                      상단의 [대량입력 Excel 서식 업로드]를 이용하거나 아래 [직접 입력 행 추가하기] 버튼 또는 <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded font-mono text-[11px] text-slate-800 font-bold">Enter</kbd> 키를 눌러 기록물을 작성하세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddRow()}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      직접 입력 행 추가하기 (Enter)
                    </button>
                  </td>
                </tr>
              ) : (
                draftRows.map((row, idx) => {
                  const isSelected = selectedLocalIds.has(row.localId);
                  const expiryYear = calculateExpiryYear(row.end_year, row.retention_period);

                  return (
                    <tr
                      key={row.localId}
                      className={`divide-x divide-slate-200 hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.localId)}
                          className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Sequence */}
                      <td className="p-2 text-center text-slate-500 font-medium">
                        {idx + 1}
                      </td>

                      {/* Record Type */}
                      <td className="p-1 text-center">
                        <select
                          ref={(el) => {
                            if (el) typeSelectRefs.current.set(row.localId, el);
                            else typeSelectRefs.current.delete(row.localId);
                          }}
                          value={row.record_type}
                          onChange={(e) => handleRowChange(row.localId, 'record_type', e.target.value as RecordType)}
                          onKeyDown={(e) => handleInputKeyDown(e, idx)}
                          className="w-full text-xs border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-blue-600 font-medium cursor-pointer"
                        >
                          <option value="일반">일반</option>
                          <option value="시청각">시청각</option>
                        </select>
                      </td>

                      {/* Start Year */}
                      <td className="p-1 text-center">
                        <input
                          type="number"
                          min={1950}
                          max={2099}
                          value={row.start_year}
                          onChange={(e) => handleRowChange(row.localId, 'start_year', parseInt(e.target.value, 10) || currentYear)}
                          onKeyDown={(e) => handleInputKeyDown(e, idx)}
                          className="w-full text-center text-xs border border-slate-300 rounded px-1 py-1 focus:outline-blue-600 font-medium"
                        />
                      </td>

                      {/* End Year */}
                      <td className="p-1 text-center">
                        <input
                          type="number"
                          min={row.start_year}
                          max={2099}
                          value={row.end_year}
                          onChange={(e) => handleRowChange(row.localId, 'end_year', parseInt(e.target.value, 10) || currentYear)}
                          onKeyDown={(e) => handleInputKeyDown(e, idx)}
                          className="w-full text-center text-xs border border-slate-300 rounded px-1 py-1 focus:outline-blue-600 font-medium"
                        />
                      </td>

                      {/* Record Title */}
                      <td className="p-1">
                        <input
                          ref={(el) => {
                            if (el) titleInputRefs.current.set(row.localId, el);
                            else titleInputRefs.current.delete(row.localId);
                          }}
                          type="text"
                          value={row.title}
                          onChange={(e) => handleRowChange(row.localId, 'title', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, idx)}
                          placeholder="기록물철 제목을 입력하세요 (엔터 시 다음 행 [유형]으로 이동)"
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1 font-semibold text-slate-900 focus:outline-blue-600 focus:bg-white"
                        />
                      </td>

                      {/* Production School / Department (생산부서) */}
                      <td className="p-1.5 bg-slate-50/40">
                        <div className="flex items-center gap-1.5">
                          <label
                            className="inline-flex items-center gap-1 cursor-pointer select-none text-[11px] font-medium text-slate-600 shrink-0 px-1 py-0.5 rounded hover:bg-slate-200 transition-colors"
                            title="생산부서가 현재 처리과와 다른 경우 체크하여 직접 입력합니다."
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(row.is_custom_dept)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                handleRowChange(row.localId, 'is_custom_dept', checked);
                                if (!checked) {
                                  handleRowChange(row.localId, 'production_school', '');
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 w-3.5 h-3.5 focus:ring-blue-500"
                            />
                            <span className={row.is_custom_dept ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                              다른 부서
                            </span>
                          </label>

                          {row.is_custom_dept ? (
                            <input
                              type="text"
                              value={row.production_school || ''}
                              onChange={(e) => handleRowChange(row.localId, 'production_school', e.target.value)}
                              onKeyDown={(e) => handleInputKeyDown(e, idx)}
                              placeholder="생산부서(학교)명"
                              className="w-full min-w-[90px] text-xs border border-blue-400 bg-blue-50/60 rounded px-1.5 py-1 font-semibold text-blue-900 focus:outline-blue-600"
                            />
                          ) : (
                            <span
                              className="flex-1 text-[11px] text-slate-500 bg-slate-100 rounded px-1.5 py-1 truncate text-center font-medium border border-slate-200"
                              title={`표지 및 현황의 처리과명(${meta.department})이 기본 적용됩니다.`}
                            >
                              {meta.department || '기본 처리과'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 과제카드 추천 트리거 버튼 */}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          id={`btn-ai-rec-${idx}`}
                          onClick={() => handleTriggerAI(row)}
                          className="w-full px-2 py-1 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                          title="과제카드 비교 및 보존기간 추천"
                        >
                          <FileSearch className="w-3 h-3 text-blue-200" />
                          추천
                        </button>
                      </td>

                      {/* Retention Period Dropdown */}
                      <td className="p-1 text-center">
                        <select
                          value={row.retention_period}
                          onChange={(e) => handleRowChange(row.localId, 'retention_period', e.target.value as RetentionPeriod)}
                          className="w-full text-xs font-bold text-blue-900 border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-blue-600"
                        >
                          {RETENTION_PERIODS.map((period) => (
                            <option key={period} value={period}>
                              {period}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Expiry Year (Auto Computed) */}
                      <td className="p-2 text-center font-bold text-slate-700 bg-slate-50">
                        {expiryYear}
                      </td>

                      {/* Box No */}
                      <td className="p-1 text-center">
                        <input
                          type="text"
                          value={row.box_no}
                          onChange={(e) => handleRowChange(row.localId, 'box_no', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, idx)}
                          placeholder=""
                          list={`existing-boxes-${row.localId}`}
                          className="w-full text-center text-xs font-semibold text-slate-800 border border-slate-300 rounded px-1.5 py-1 focus:outline-blue-600"
                          title="기존 상자번호를 선택하거나 새 상자번호를 입력할 수 있습니다."
                        />
                        <datalist id={`existing-boxes-${row.localId}`}>
                          {getExistingBoxNumbers(row.retention_period, row.end_year, records).map((b) => (
                            <option key={b} value={b} />
                          ))}
                        </datalist>
                      </td>

                      {/* Shelf No */}
                      <td className="p-1 text-center">
                        <input
                          type="text"
                          value={row.shelf_no}
                          onChange={(e) => handleRowChange(row.localId, 'shelf_no', e.target.value)}
                          onKeyDown={(e) => handleInputKeyDown(e, idx)}
                          placeholder=""
                          className="w-full text-center text-xs font-semibold text-slate-800 border border-slate-300 rounded px-1.5 py-1 focus:outline-blue-600"
                        />
                      </td>

                      {/* Remove Row */}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftRows((prev) => prev.filter((r) => r.localId !== row.localId));
                            const nextSel = new Set(selectedLocalIds);
                            nextSel.delete(row.localId);
                            setSelectedLocalIds(nextSel);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                          title="행 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Action Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              새로운 행 추가
            </button>
            <span className="text-xs text-slate-500">
              (여러 건을 동시에 작성하고 체크박스로 선택하여 한 번에 확정하세요)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCompleteSelected}
              disabled={selectedLocalIds.size === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              선택한 {selectedLocalIds.size}개 항목 정식 등록 [입력완료]
            </button>
          </div>
        </div>
      </div>

      {/* Practical Guide Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Info className="w-4 h-4 text-blue-600" />
          업무 처리 가이드
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
          <li>
            <strong>단일 원본 데이터 원칙:</strong> 입력완료된 기록물은 보존기간에 따라 [영구], [10년], [5년] 등 해당 화면으로 즉시 자동 분류됩니다.
          </li>
          <li>
            <strong>만료연도 자동 계산:</strong> 만료연도는 <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">종료년도 + 보존기간</code>으로 자동 계산되며, 영구 기록물은 <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">-</code>로 처리됩니다.
          </li>
          <li>
            <strong>상자번호 연동:</strong> 동일한 상자번호를 입력하면 라벨정보 화면에서 자동으로 묶여 상자 표지가 생성됩니다.
          </li>
        </ul>
      </div>

      {/* AI Recommendation Modal */}
      <AIRecommendModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        recordTitle={activeAnalyzingTitle}
        recommendation={aiResult}
        isLoading={aiLoading}
        onApplyPeriod={handleApplyAIPeriod}
      />
    </div>
  );
};
