import React, { useRef, useState } from 'react';
import {
  RecordItem,
  DepartmentMeta,
  TaskCard,
  FullExcelImportResult,
} from '../types';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Layers,
  Archive,
  Loader2,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import {
  exportRecordsToExcel,
  parseFullExcelBackupFile,
} from '../utils/excelUtils';

interface ExcelExportViewProps {
  records: RecordItem[];
  meta: DepartmentMeta;
  taskCards?: TaskCard[];
  onImportOverwrite?: (result: FullExcelImportResult) => void;
  onImportRecords?: (newRecords: RecordItem[]) => void;
}

export const ExcelExportView: React.FC<ExcelExportViewProps> = ({
  records,
  meta,
  taskCards = [],
  onImportOverwrite,
}) => {
  const activeRecords = records.filter((r) => r.is_completed && !r.is_disposed && !r.is_transferred);
  const pendingRecords = records.filter((r) => !r.is_completed && !r.is_disposed && !r.is_transferred);
  const disposedRecords = records.filter((r) => r.is_disposed);
  const transferredRecords = records.filter((r) => r.is_transferred && !r.is_disposed);

  // 엑셀 불러오기 관련 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<FullExcelImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 전체 통합 대장 다운로드 (13개 시트 통합)
  const handleDownloadFull = async () => {
    try {
      setExportStatus(null);
      const res = await exportRecordsToExcel(records, meta, taskCards);
      if (res?.success && res?.filePath) {
        setExportStatus({
          message: `엑셀 통합문서가 성공적으로 저장되었습니다. (저장 경로: ${res.filePath})`,
          type: 'success',
        });
      } else if (res?.error) {
        setExportStatus({ message: res.error, type: 'error' });
      }
    } catch (err: any) {
      setExportStatus({
        message: err?.message || '엑셀 내보내기 중 오류가 발생했습니다.',
        type: 'error',
      });
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

  // 12개 시트 규격 안내
  const sheetsInfo = [
    { name: '표지 및 현황', desc: '기관명, 처리과, 기준일자 및 보존기간별 총괄 현황 집계표 (공문 서식)', count: `${activeRecords.length}건 집계` },
    { name: '입력 (신규/일괄)', desc: '학교 기록물 신규 및 일괄 등록', count: `${pendingRecords.length}건 작성중` },
    { name: '영구', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '영구').length}건` },
    { name: '준영구', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '준영구').length}건` },
    { name: '30년', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '30년').length}건` },
    { name: '10년', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '10년').length}건` },
    { name: '5년', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '5년').length}건` },
    { name: '3년', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '3년').length}건` },
    { name: '1년', desc: '문서고보존기록대장 표준 서식 (14개 항목 2단 헤더, 만료일자 수식/서식 연동)', count: `${records.filter(r => r.is_completed && !r.is_disposed && !r.is_transferred && r.retention_period === '1년').length}건` },
    { name: '과제카드', desc: '과제카드명, 기준 보존기간, 주요 업무 설명', count: `${taskCards.length}개 기준` },
    { name: '라벨정보', desc: '상자번호 및 서가번호별 수록 기록물 목록 및 라벨 색인', count: '상자별 집계' },
    { name: '폐기목록', desc: '폐기 처리된 기록물 스냅샷 및 폐기일자 이력 대장', count: `${disposedRecords.length}건 보존` },
    { name: '이관목록', desc: '교육청 기록관 등으로 이관 처리된 기록물 및 이관일자/이관처 이력 대장', count: `${transferredRecords.length}건 이관` },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Hidden File Input for Excel Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="hidden"
        id="excel-view-file-input"
      />

      {/* 내보내기 결과 알림 배너 */}
      {exportStatus && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between shadow-xs ${
            exportStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">
              {exportStatus.type === 'success' ? '✓ 저장 완료:' : '✕ 오류:'}
            </span>
            <span>{exportStatus.message}</span>
          </div>
          <button
            onClick={() => setExportStatus(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. 전체 통합 대장 다운로드 및 불러오기 섹션 */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              전체 대장 통합 Excel 내보내기 및 불러오기
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            공공기록물 관리 표준 서식에 맞춰 <strong className="text-slate-800">13개 시트(표지, 입력, 각 보존기간, 과제카드, 라벨정보, 폐기목록, 이관목록)가 모두 포함된 단일 통합 엑셀 파일(.xlsx)</strong>을 다운로드하거나, 다른 컴퓨터에서 내보낸 엑셀 백업 파일을 불러와 전체 대장을 복원(덮어씌우기)할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
          <button
            id="btn-export-full-excel"
            type="button"
            onClick={handleDownloadFull}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            전체 대장 내보내기 (.xlsx)
          </button>

          <button
            id="btn-import-full-excel-view"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImportLoading}
            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
            title="다른 컴퓨터에서 내보낸 엑셀 백업 파일을 불러와 현재 대장 데이터를 덮어씌웁니다."
          >
            {isImportLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Excel 불러오기 (덮어씌우기)
          </button>
        </div>
      </div>

      {/* 2. 통합 문서 내 12개 시트 구성 상세 안내 */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          통합 엑셀 파일 내 포함되는 12개 시트 구성
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sheetsInfo.map((sh, idx) => (
            <div
              key={idx}
              className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-slate-900">{sh.name}</span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded border border-emerald-200">
                  {sh.count}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">{sh.desc}</p>
            </div>
          ))}
        </div>
      </div>

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
                id="btn-confirm-overwrite-view"
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
    </div>
  );
};
