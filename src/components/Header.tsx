import React, { useState, useRef } from 'react';
import { DepartmentMeta, RecordItem, TaskCard, FullExcelImportResult } from '../types';
import {
  Calendar,
  Building,
  Download,
  Upload,
  Printer,
  RotateCcw,
  Check,
  Edit2,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  X,
} from 'lucide-react';
import { exportRecordsToExcel, parseFullExcelBackupFile } from '../utils/excelUtils';

import { isTauriEnvironment, isElectronEnvironment, isDesktopApp } from '../utils/desktopBridge';

interface HeaderProps {
  meta: DepartmentMeta;
  onUpdateMeta: (newMeta: DepartmentMeta) => void;
  records: RecordItem[];
  taskCards?: TaskCard[];
  onOpenLabelModal: () => void;
  onResetToSampleData?: () => void;
  onClearAllRecords?: () => void;
  onImportOverwrite?: (result: FullExcelImportResult) => void;
}

export const Header: React.FC<HeaderProps> = ({
  meta,
  onUpdateMeta,
  records,
  taskCards = [],
  onOpenLabelModal,
  onResetToSampleData,
  onClearAllRecords,
  onImportOverwrite,
}) => {
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [tempDepartment, setTempDepartment] = useState(meta.department);
  const [tempBaseDate, setTempBaseDate] = useState(meta.base_date);
  const [tempSchoolName, setTempSchoolName] = useState(meta.institution || meta.school_name);

  // meta prop 변경 시 동기화
  React.useEffect(() => {
    setTempDepartment(meta.department);
    setTempBaseDate(meta.base_date);
    setTempSchoolName(meta.institution || meta.school_name);
  }, [meta.department, meta.base_date, meta.school_name, meta.institution]);

  // 엑셀 불러오기 관련 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<FullExcelImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const activeRecords = records.filter((r) => r.is_completed && !r.is_disposed && !r.is_transferred);
  const isTauri = isTauriEnvironment();
  const isElectron = isElectronEnvironment();
  const isDesktop = isDesktopApp();

  const handleSaveMeta = () => {
    const institutionName = tempSchoolName.trim() || '전북특별자치도교육청';
    onUpdateMeta({
      ...meta,
      department: tempDepartment.trim() || '행정실',
      base_date: tempBaseDate.trim() || new Date().toISOString().split('T')[0],
      school_name: institutionName,
      institution: institutionName,
    });
    setIsEditingMeta(false);
  };

  const handleExcelQuickDownload = async () => {
    try {
      await exportRecordsToExcel(records, meta, taskCards);
    } catch (err: any) {
      console.error('Excel export error:', err);
      alert(err?.message || '엑셀 내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportLoading(true);
    setImportError(null);

    try {
      const result = await parseFullExcelBackupFile(file);
      if (
        result.records.length === 0 &&
        !result.meta &&
        (!result.taskCards || result.taskCards.length === 0)
      ) {
        throw new Error('선택하신 엑셀 파일에서 유효한 기록물이나 대장 데이터를 찾을 수 없습니다.');
      }
      setImportPreview(result);
    } catch (err: any) {
      setImportError(err.message || '엑셀 파일을 읽는 도중 오류가 발생했습니다.');
    } finally {
      setIsImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmOverwrite = () => {
    if (importPreview && onImportOverwrite) {
      onImportOverwrite(importPreview);
      setImportPreview(null);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-20 shadow-xs">
      {/* Hidden File Input for Excel Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="hidden"
        id="header-excel-file-input"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Title and Department info */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                학교 기록물 관리
              </h1>
              <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded border border-slate-200">
                v1.1.2
              </span>
              <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded border border-blue-200">
                표준 보존기록대장
              </span>
              {isTauri && (
                <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  Tauri v2 데스크톱 앱
                </span>
              )}
              {!isTauri && isElectron && (
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                  Electron 데스크톱 앱
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {meta.institution || meta.school_name} · {meta.department}
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                기준일자: <strong className="text-slate-700">{meta.base_date}</strong>
              </span>
              <button
                id="edit-meta-btn"
                onClick={() => {
                  setTempDepartment(meta.department);
                  setTempBaseDate(meta.base_date);
                  setTempSchoolName(meta.institution || meta.school_name);
                  setIsEditingMeta(true);
                }}
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-0.5 font-medium cursor-pointer"
                title="처리과 및 기준일자 수정"
              >
                <Edit2 className="w-3 h-3" />
                수정
              </button>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="header-btn-excel"
            onClick={handleExcelQuickDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
            title="기존 엑셀파일 서식을 보존한 12개 시트 통합 .xlsx 내보내기"
          >
            <Download className="w-3.5 h-3.5" />
            Excel 내보내기
          </button>

          <button
            id="header-btn-excel-import"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImportLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
            title="다른 컴퓨터에서 내보낸 엑셀 백업 파일을 불러와 현재 대장 데이터 덮어씌우기"
          >
            {isImportLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Excel 불러오기
          </button>

          <button
            id="header-btn-print-labels"
            onClick={onOpenLabelModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            상자 라벨 인쇄
          </button>

          {records.length > 0 && onClearAllRecords && (
            <button
              id="header-btn-clear-all"
              onClick={onClearAllRecords}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 transition-colors cursor-pointer"
              title="초기 빈 상태로 비우기"
            >
              대장 비우기
            </button>
          )}
        </div>
      </div>

      {/* Inline Modal for Department Meta Editing */}
      {isEditingMeta && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">
              처리과 및 기준일자 설정
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-slate-700 text-xs mb-1">
                  학교명
                </label>
                <input
                  type="text"
                  value={tempSchoolName}
                  onChange={(e) => setTempSchoolName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-blue-500"
                  placeholder="예: 한국초등학교"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 text-xs mb-1">
                  처리과명
                </label>
                <input
                  type="text"
                  value={tempDepartment}
                  onChange={(e) => setTempDepartment(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-blue-500"
                  placeholder="예: 행정실"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 text-xs mb-1">
                  기준일자
                </label>
                <input
                  type="date"
                  value={tempBaseDate}
                  onChange={(e) => setTempBaseDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm focus:outline-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsEditingMeta(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveMeta}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Confirmation Modal */}
      {importPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-blue-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-base font-bold">Excel 대장 데이터 불러오기 (덮어씌우기)</h3>
              </div>
              <button
                onClick={() => setImportPreview(null)}
                className="text-blue-100 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-amber-950 mb-1">주의: 현재 대장 데이터 덮어씌우기 안내</p>
                  <p>
                    선택하신 엑셀 파일의 데이터로 이 컴퓨터의 현재 보존기록대장, 과제카드, 기관 설정이 <strong>완전히 대체(덮어씌우기)</strong>됩니다.
                  </p>
                </div>
              </div>

              {/* Source File Info */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2">
                <div className="text-xs text-slate-500 font-medium">선택된 엑셀 백업 파일</div>
                <div className="font-semibold text-slate-800 truncate text-sm">
                  {importPreview.sourceFileName}
                </div>

                {importPreview.meta && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 text-slate-600">
                    <div>
                      학교명: <strong className="text-slate-800">{importPreview.meta.school_name || '미지정'}</strong>
                    </div>
                    <div>
                      처리과: <strong className="text-slate-800">{importPreview.meta.department || '미지정'}</strong>
                    </div>
                    <div>
                      기준일자: <strong className="text-slate-800">{importPreview.meta.base_date || '미지정'}</strong>
                    </div>
                    <div>
                      작성자: <strong className="text-slate-800">{importPreview.meta.manager_name || '미지정'}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Record Statistics */}
              <div className="border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="text-xs text-slate-500 font-medium">불러올 데이터 내역</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                    <div className="text-xs text-blue-600 font-medium">총 기록물</div>
                    <div className="text-lg font-bold text-blue-900">{importPreview.stats.totalRecords}건</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2">
                    <div className="text-xs text-emerald-600 font-medium">정상 보존</div>
                    <div className="text-lg font-bold text-emerald-900">{importPreview.stats.activeRecords}건</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2">
                    <div className="text-xs text-amber-600 font-medium">작성중/미완료</div>
                    <div className="text-lg font-bold text-amber-900">{importPreview.stats.pendingRecords}건</div>
                  </div>
                  <div className="bg-slate-100 border border-slate-200 rounded-md p-2">
                    <div className="text-xs text-slate-600 font-medium">폐기/이관</div>
                    <div className="text-lg font-bold text-slate-900">
                      {importPreview.stats.disposedRecords + importPreview.stats.transferredRecords}건
                    </div>
                  </div>
                </div>

                {importPreview.stats.taskCardsCount > 0 && (
                  <div className="text-xs text-slate-600 pt-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    과제카드 기준 데이터: <strong>{importPreview.stats.taskCardsCount}건</strong> 포함
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                id="confirm-import-overwrite-btn"
                onClick={handleConfirmOverwrite}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                데이터 덮어씌우기 (불러오기 완료)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {importError && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900">엑셀 불러오기 실패</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{importError}</p>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setImportError(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-900 cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
