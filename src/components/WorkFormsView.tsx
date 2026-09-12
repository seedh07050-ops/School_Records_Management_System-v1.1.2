import React, { useState } from 'react';
import { DepartmentMeta } from '../types';
import {
  FileText,
  Download,
  CheckCircle2,
  UserCheck,
  ArrowRightLeft,
  DoorOpen,
  Truck,
  FileSignature,
  Loader2,
  FolderDown,
} from 'lucide-react';
import { desktopBridge, isTauriEnvironment, isDesktopApp } from '../utils/desktopBridge';

interface WorkFormsViewProps {
  meta?: DepartmentMeta;
}

interface FormItem {
  id: string;
  name: string;
  fileName: string;
  icon: React.ElementType;
}

export const WorkFormsView: React.FC<WorkFormsViewProps> = () => {
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isTauri = isTauriEnvironment();
  const isDesktop = isDesktopApp();

  const forms: FormItem[] = [
    {
      id: 'manager',
      name: '기록물관리 책임자 지정',
      fileName: '기록물관리 책임자 지정.hwpx',
      icon: UserCheck,
    },
    {
      id: 'in_out',
      name: '기록물반출입대장',
      fileName: '기록물반출입대장.hwpx',
      icon: ArrowRightLeft,
    },
    {
      id: 'archive_access',
      name: '문서고출입대장',
      fileName: '문서고출입대장.hwpx',
      icon: DoorOpen,
    },
    {
      id: 'transfer_plan',
      name: '비전자기록물 이관계획',
      fileName: '비전자기록물 이관계획.hwpx',
      icon: Truck,
    },
    {
      id: 'handover',
      name: '비전자기록물 인계인수서',
      fileName: '비전자기록물 인계인수서.hwpx',
      icon: FileSignature,
    },
  ];

  const handleDownload = async (form: FormItem) => {
    setIsProcessing(true);
    try {
      const res = await desktopBridge.saveFormFile(form.fileName);
      if (res.success) {
        setDownloadSuccessMessage(`[${form.name}] 파일이 안전하게 저장되었습니다.`);
        setTimeout(() => setDownloadSuccessMessage(null), 4000);
      } else if (!res.canceled && res.error) {
        alert(`서식 파일 저장 중 오류가 발생했습니다: ${res.error}`);
      }
    } catch (err: any) {
      console.error('Download error:', err);
      alert(`다운로드 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsProcessing(true);
    try {
      const fileNames = forms.map((f) => f.fileName);
      const res = await desktopBridge.saveAllForms(fileNames);
      if (res.success) {
        setDownloadSuccessMessage(
          res.folderPath
            ? `업무서식 5종이 선택하신 폴더(${res.folderPath})에 성공적으로 저장되었습니다.`
            : '업무서식 5종이 모두 다운로드되었습니다.'
        );
        setTimeout(() => setDownloadSuccessMessage(null), 5000);
      } else if (!res.canceled && res.errors && res.errors.length > 0) {
        alert(`일부 서식 파일 저장 중 오류가 발생했습니다:\n${res.errors.join('\n')}`);
      }
    } catch (err: any) {
      console.error('Download all error:', err);
      alert(`일괄 다운로드 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                표준 서식 5종
              </span>
              {isDesktop && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  {isTauri ? 'Tauri 네이티브 로컬 저장 지원' : '데스크톱 로컬 저장 지원'}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-600" />
              업무서식
            </h2>
            <p className="text-sm text-slate-600">
              기록물 관리에 필요한 표준 서식 파일(HWPX)을 다운로드할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleDownloadAll}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isDesktop ? (
                <FolderDown className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isDesktop ? '폴더 선택 후 전체 저장 (5종)' : '전체 서식 다운로드 (5종)'}
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {downloadSuccessMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{downloadSuccessMessage}</span>
        </div>
      )}

      {/* Forms List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {forms.map((form, index) => {
          const Icon = form.icon;
          return (
            <div
              key={form.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="font-bold text-base text-slate-900">
                      {form.name}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {form.fileName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  HWPX
                </span>
                <button
                  onClick={() => handleDownload(form)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-900 hover:bg-blue-600 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
