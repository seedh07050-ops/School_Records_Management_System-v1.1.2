import React, { useState, useEffect } from 'react';
import { BoxGroup, DepartmentMeta } from '../types';
import {
  DEFAULT_HWP_TEMPLATE,
  generatePrintableHwpHtml,
  generatePrintablePagesHtml,
} from '../utils/hwpLabelUtils';
import { isTauriEnvironment } from '../utils/desktopBridge';
import {
  Printer,
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  FileText,
} from 'lucide-react';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: BoxGroup[];
  meta: DepartmentMeta;
  customTaskFontSize?: number | null;
  onCustomFontSizeChange?: (size: number | null) => void;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  isOpen,
  onClose,
  boxes,
  meta,
  customTaskFontSize = null,
  onCustomFontSizeChange,
}) => {
  const [zoom, setZoom] = useState<number>(0.75); // 기본 미리보기 75%
  const totalPages = Math.ceil(boxes.length / 4);

  // A4 페이지 HTML 목록 (customTaskFontSize 반영)
  const pagesHtml = React.useMemo(() => {
    if (!isOpen || boxes.length === 0) return [];
    return generatePrintablePagesHtml(boxes, meta, DEFAULT_HWP_TEMPLATE, customTaskFontSize);
  }, [isOpen, boxes, meta, customTaskFontSize]);

  // 단축키 (Ctrl+P / Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleDirectPrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || boxes.length === 0) return null;

  // 1. 현재 창 직접 인쇄 (팝업 차단 100% 우회 & WebView2/Tauri 완벽 호환)
  const handleDirectPrint = () => {
    window.print();
  };

  // 2. 새 창에서 열기 (Tauri WebviewWindow 또는 브라우저 팝업 fallback)
  const handleOpenNewWindow = async () => {
    const fullHtml = generatePrintableHwpHtml(boxes, meta, DEFAULT_HWP_TEMPLATE, customTaskFontSize);

    if (isTauriEnvironment()) {
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const windowLabel = `print-labels-${Date.now()}`;
        const newWin = new WebviewWindow(windowLabel, {
          title: '보존기록물 상자 표지 라벨 인쇄',
          url: `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`,
          width: 960,
          height: 980,
          center: true,
        });

        newWin.once('tauri://error', (e) => {
          console.warn('Tauri WebviewWindow 생성 오류, 현재 창 인쇄로 대체:', e);
          handleDirectPrint();
        });
        return;
      } catch (err) {
        console.warn('WebviewWindow API 로드 실패, 현재 창 인쇄로 대체:', err);
        handleDirectPrint();
        return;
      }
    }

    // 일반 브라우저 환경 fallback
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
      } else {
        // 팝업이 차단된 경우 현재 창 직접 인쇄로 즉시 연결
        handleDirectPrint();
      }
    } catch {
      handleDirectPrint();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs">
      {/* 상단 툴바 (화면 표시용, 인쇄 시 자동 숨김) */}
      <div className="no-print bg-slate-900 border-b border-slate-700 px-5 py-3 flex items-center justify-between shadow-md text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                보존기록물 상자 표지 라벨 인쇄 미리보기
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                총 {boxes.length}개 상자 (A4 {totalPages}장)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {meta.institution || meta.school_name || '전북특별자치도교육청'} 표준 A4 2×2 분할 규격 (상자표지) · Ctrl+P 또는 인쇄 버튼 클릭 시 바로 출력됩니다.
            </p>
          </div>
        </div>

        {/* 중앙: 줌 배율 제어 & 업무명 글씨크기 조절 */}
        <div className="hidden md:flex items-center gap-3">
          {onCustomFontSizeChange && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-200 font-medium">
                <input
                  type="checkbox"
                  checked={customTaskFontSize !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onCustomFontSizeChange(8);
                    } else {
                      onCustomFontSizeChange(null);
                    }
                  }}
                  className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-400 w-3.5 h-3.5"
                />
                <span>글씨크기 변경:</span>
              </label>
              <select
                disabled={customTaskFontSize === null}
                value={customTaskFontSize || 8}
                onChange={(e) => onCustomFontSizeChange(Number(e.target.value))}
                className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-0.5 text-xs focus:outline-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value={5}>5pt (가장 작게)</option>
                <option value={6}>6pt (매우 작게)</option>
                <option value={7}>7pt (작게)</option>
                <option value={8}>8pt (표준)</option>
                <option value={9}>9pt (약간 크게)</option>
                <option value={10}>10pt (크게)</option>
                <option value={11}>11pt (더 크게)</option>
                <option value={12}>12pt (가장 크게)</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="축소"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono w-12 text-center font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.2, z + 0.1))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="확대"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(0.75)}
              className="ml-1 text-[11px] px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              기본
            </button>
          </div>
        </div>

        {/* 우측 작업 버튼 */}
        <div className="flex items-center gap-2">
          <button
            id="btn-print-direct"
            onClick={handleDirectPrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer transition-all hover:shadow-emerald-500/20"
          >
            <Printer className="w-4 h-4" />
            인쇄하기 (출력 / PDF 저장)
          </button>

          <button
            id="btn-print-new-window"
            onClick={handleOpenNewWindow}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium inline-flex items-center gap-1.5 border border-slate-600 cursor-pointer transition-colors"
            title="새 창에서 라벨 미리보기 열기"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            새 창으로 열기
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="미리보기 닫기 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 인쇄 전용 및 화면 미리보기 뷰어 영역 */}
      <div className="flex-1 overflow-y-auto bg-slate-950/60 p-6 flex flex-col items-center">
        {/* 인쇄 시 실제 프린터로 전송되는 포털 컨테이너 */}
        <div
          id="label-print-portal"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="flex flex-col items-center gap-6"
        >
          {pagesHtml.map((pageHtml, idx) => (
            <div key={idx} className="relative group">
              {/* 화면용 페이지 인디케이터 (인쇄 시 자동 숨김) */}
              <div className="no-print absolute -top-4 left-0 text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                A4 {idx + 1} / {totalPages} 페이지
              </div>
              {/* 실제 A4 라벨 인쇄 페이지 */}
              <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
